import "dotenv/config";
import { prisma } from "../prisma";
import { hashPassword } from "../services/auth";

async function createAdmin() {
  const email = process.argv[2];
  const password = process.argv[3];
  const adminRole = process.argv[4] || 'SUPER_ADMIN';
  
  if (!email || !password) {
    console.error('Usage: ts-node create-admin.ts <email> <password> [adminRole]');
    console.error('Admin roles: SUPER_ADMIN, ADMIN, MODERATOR, SUPPORT');
    process.exit(1);
  }
  
  try {
    // Check if user exists
    const existing = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existing) {
      // Update to admin
      const passwordHash = await hashPassword(password);
      const user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          adminRole: adminRole as any,
          role: 'ADMIN', // Also set regular role
        }
      });
      console.log(`✅ Updated user ${email} to ${adminRole}`);
      console.log(`   User ID: ${user.id}`);
      return user;
    }
    
    // Create new admin
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: 'Admin User',
        role: 'ADMIN',
        adminRole: adminRole as any,
        subscriptionPlan: 'FREE', // Admins don't need subscription
        subscriptionStatus: 'ACTIVE',
      }
    });
    
    console.log(`✅ Created admin user ${email} with role ${adminRole}`);
    console.log(`   User ID: ${user.id}`);
    return user;
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
