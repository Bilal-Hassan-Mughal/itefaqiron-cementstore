const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listUsers() {
    try {
        const users = await prisma.users.findMany({
            select: {
                user_id: true,
                full_name: true,
                email: true,
                role: true,
                status: true,
                is_verified: true,
                created_at: true
            },
            orderBy: { created_at: 'desc' }
        });

        console.log('\n📋 Current Users in Database:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('ID  | Role          | Email                              | Name');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        users.forEach(user => {
            const id = String(user.user_id).padEnd(3);
            const role = user.role.padEnd(13);
            const email = user.email.padEnd(35);
            const name = user.full_name;
            console.log(`${id} | ${role} | ${email} | ${name}`);
        });

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`\nTotal users: ${users.length}\n`);
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

listUsers();
