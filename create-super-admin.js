const prisma = require('@prisma/client').PrismaClient;

const db = new prisma();

async function createSuperAdmin() {
  try {
    // Check if user already exists
    const existingUser = await db.users.findUnique({
      where: { email: 'gondalzain717@gmail.com' }
    });

    if (existingUser) {
      console.log('✅ Super admin already exists with email: gondalzain717@gmail.com');
      console.log('User details:', {
        user_id: existingUser.user_id,
        full_name: existingUser.full_name,
        email: existingUser.email,
        role: existingUser.role,
        status: existingUser.status
      });
      process.exit(0);
    }

    // Create super admin user
    const superAdmin = await db.users.create({
      data: {
        full_name: 'Super Admin',
        email: 'gondalzain717@gmail.com',
        password: 'zain1234',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        is_verified: true
      }
    });

    console.log('✅ Super admin account created successfully!');
    console.log('Login details:');
    console.log('  Email: gondalzain717@gmail.com');
    console.log('  Password: zain1234');
    console.log('  Role: SUPER_ADMIN');
    console.log('\nUser details:');
    console.log('  User ID:', superAdmin.user_id);
    console.log('  Name:', superAdmin.full_name);
    console.log('  Status:', superAdmin.status);
    console.log('  Created at:', superAdmin.created_at);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating super admin:', error.message);
    process.exit(1);
  }
}

createSuperAdmin();
