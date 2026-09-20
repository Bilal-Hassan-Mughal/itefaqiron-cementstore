import { NextResponse } from 'next/server';
import { requireHqActor } from '@/lib/hq-server';
import {
  buildExcelBuffer,
  buildExportFilename,
  createExportConnection,
  formatExportBytes,
  formatExportDuration,
  generateSqlDump,
  getExportPreview,
  listExportTables,
  loadFullDatabaseExportTarget,
} from '@/lib/hq-data-export';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function parseFormat(request) {
  const { searchParams } = new URL(request.url);
  const format = (searchParams.get('format') || 'sql').toLowerCase();
  if (format === 'xlsx') return 'excel';
  return format;
}

/** GET — preview export stats, or download full database backup as SQL (default) or Excel */
export async function GET(request) {
  const scope = requireHqActor(request);
  if (scope.error) return scope.error;

  const { searchParams } = new URL(request.url);
  const format = parseFormat(request);
  if (!['sql', 'excel'].includes(format)) {
    return NextResponse.json({ error: 'Invalid format. Use sql or excel.' }, { status: 400 });
  }

  let connection;
  try {
    const target = await loadFullDatabaseExportTarget();
    connection = await createExportConnection(target.config);

    if (searchParams.get('preview') === 'true') {
      const preview = await getExportPreview(
        connection,
        target.config.database,
        target.tableFilter,
        format
      );
      await connection.end();
      connection = null;

      if (!preview.tableCount) {
        return NextResponse.json({ error: 'No tables found in the database.' }, { status: 404 });
      }

      return NextResponse.json({
        database: target.databaseName,
        scopeLabel: target.scopeLabel,
        format,
        ...preview,
        estimatedSizeLabel: formatExportBytes(preview.estimatedBytes),
        estimatedTimeLabel: formatExportDuration(preview.estimatedSeconds),
      });
    }

    const tables = await listExportTables(connection, target.config.database, target.tableFilter);

    if (!tables.length) {
      return NextResponse.json({ error: 'No tables found in the database.' }, { status: 404 });
    }

    const preview = await getExportPreview(
      connection,
      target.config.database,
      target.tableFilter,
      format
    );
    const filename = buildExportFilename(target.databaseName, format);
    const sharedHeaders = {
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'X-Estimated-Bytes': String(preview.estimatedBytes || 0),
      'X-Estimated-Seconds': String(preview.estimatedSeconds || 0),
      'X-Export-Tables': String(preview.tableCount || tables.length),
    };

    if (format === 'excel') {
      const buffer = await buildExcelBuffer(connection, tables);
      await connection.end();
      connection = null;

      return new NextResponse(buffer, {
        headers: {
          ...sharedHeaders,
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Length': String(buffer.length),
        },
      });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of generateSqlDump(connection, target.config.database, tables)) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        } finally {
          if (connection) {
            await connection.end().catch(() => {});
            connection = null;
          }
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        ...sharedHeaders,
        'Content-Type': 'application/sql; charset=utf-8',
      },
    });
  } catch (err) {
    if (connection) {
      await connection.end().catch(() => {});
    }
    console.error('GET /api/hq/data-export', err);
    const status = err.status || 500;
    return NextResponse.json({ error: err.message || 'Export failed' }, { status });
  }
}
