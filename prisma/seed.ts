import bcrypt from 'bcryptjs';
import { prisma } from '../src/prisma/client';

async function main() {
    console.log('🌱 Starting CityCare Pro database seed...');

    // 1. Clean existing seed data (optional/safe)
    // 2. Seed Departments
    const departmentsData = [
        { name: 'Road & Transport', code: 'ROAD', description: 'Streets, potholes, traffic lights, and pavements' },
        { name: 'Water & Sanitation', code: 'WATER', description: 'Water supply leaks, drainage, sewage, and water quality' },
        { name: 'Electricity & Power', code: 'ELEC', description: 'Streetlights, power outages, and exposed cables' },
        { name: 'Waste Management', code: 'WASTE', description: 'Garbage collection, illegal dumping, and recycling' },
        { name: 'Public Safety', code: 'SAFE', description: 'Fallen trees, road hazards, and community safety' },
        { name: 'Parks & Recreation', code: 'PARK', description: 'Public park maintenance, playgrounds, and benches' },
    ];

    const departments: Record<string, any> = {};
    for (const d of departmentsData) {
        departments[d.code] = await prisma.department.upsert({
            where: { code: d.code },
            update: {},
            create: d,
        });
    }
    console.log('✅ Departments seeded.');

    // 3. Seed Demo Users for all 3 Roles
    const passwordHash = await bcrypt.hash('admin123456', 10);
    const staffPasswordHash = await bcrypt.hash('staff123456', 10);
    const citizenPasswordHash = await bcrypt.hash('citizen123456', 10);

    const adminUser = await prisma.user.upsert({
        where: { email: 'admin@citycare.com' },
        update: {},
        create: {
            name: 'CityCare Administrator',
            email: 'admin@citycare.com',
            password: passwordHash,
            role: 'ADMIN',
            phone: '+1-555-0100',
        },
    });

    const staffUser = await prisma.user.upsert({
        where: { email: 'staff@citycare.com' },
        update: {},
        create: {
            name: 'Sarah Davis',
            email: 'staff@citycare.com',
            password: staffPasswordHash,
            role: 'STAFF',
            departmentId: departments['ROAD'].id,
            phone: '+1-555-0101',
        },
    });

    const citizenUser = await prisma.user.upsert({
        where: { email: 'citizen@citycare.com' },
        update: {},
        create: {
            name: 'John Citizen',
            email: 'citizen@citycare.com',
            password: citizenPasswordHash,
            role: 'CITIZEN',
            phone: '+1-555-0102',
        },
    });
    console.log('✅ Demo Users (Admin, Staff, Citizen) seeded.');

    // 4. Seed Initial Complaints
    const sampleComplaints = [
        {
            trackingNumber: 'CC-2026-0042',
            title: 'Pothole on Main Street',
            description: 'Large pothole on Main Street near the intersection with 5th Avenue causing traffic issues and vehicle damage.',
            category: 'Road',
            priority: 'HIGH',
            status: 'PENDING',
            location: '123 Main St, Downtown',
            citizenId: citizenUser.id,
            departmentId: departments['ROAD'].id,
            isPremiumService: false,
            serviceFee: 0.00,
            paymentStatus: 'NOT_APPLICABLE',
            timelines: [
                { content: 'Complaint submitted', desc: 'Initial report filed by citizen. Awaiting review.', status: 'PENDING', actorId: citizenUser.id },
            ],
        },
        {
            trackingNumber: 'CC-2026-0043',
            title: 'Water Leak near Riverside Park',
            description: 'Water pipe burst flooding the pedestrian sidewalk and nearby grass area.',
            category: 'Water',
            priority: 'URGENT',
            status: 'ASSIGNED',
            location: '456 Oak Ave, Riverside',
            citizenId: citizenUser.id,
            departmentId: departments['WATER'].id,
            assignedStaffId: staffUser.id,
            isPremiumService: false,
            serviceFee: 0.00,
            paymentStatus: 'NOT_APPLICABLE',
            timelines: [
                { content: 'Complaint submitted', desc: 'Awaiting review.', status: 'PENDING', actorId: citizenUser.id },
                { content: 'Assigned to Water Department', desc: 'Staff member assigned for field check.', status: 'ASSIGNED', actorId: adminUser.id },
            ],
        },
        {
            trackingNumber: 'CC-2026-0044',
            title: 'Express Hazardous Waste Removal',
            description: 'Specialized chemical debris and industrial waste dumped near construction site requiring certified removal.',
            category: 'Waste',
            priority: 'URGENT',
            status: 'IN_PROGRESS',
            location: '789 Industrial Way, Sector 4',
            citizenId: citizenUser.id,
            departmentId: departments['WASTE'].id,
            assignedStaffId: staffUser.id,
            isPremiumService: true,
            serviceFee: 25.00,
            paymentStatus: 'PAID',
            timelines: [
                { content: 'Premium Service Request Submitted', desc: 'Specialized waste clearance request.', status: 'PENDING', actorId: citizenUser.id },
                { content: 'Payment Confirmed', desc: 'Service fee of $25.00 confirmed via Stripe.', status: 'PENDING', actorId: citizenUser.id },
                { content: 'Dispatched Specialized Crew', desc: 'Staff en route with safety gear.', status: 'IN_PROGRESS', actorId: staffUser.id },
            ],
        },
    ];

    for (const c of sampleComplaints) {
        const { timelines, ...data } = c;
        const complaint = await prisma.complaint.upsert({
            where: { trackingNumber: data.trackingNumber },
            update: {},
            create: data,
        });

        for (const t of timelines) {
            await prisma.complaintTimeline.create({
                data: {
                    complaintId: complaint.id,
                    ...t,
                },
            });
        }
    }
    console.log('✅ Sample complaints with timelines seeded.');

    // 5. Seed Audit Log
    await prisma.auditLog.create({
        data: {
            actorId: adminUser.id,
            actorName: adminUser.name,
            actorRole: adminUser.role,
            action: 'SYSTEM_INIT',
            targetType: 'System',
            details: 'CityCare Pro platform initial database seed completed successfully.',
        },
    });
    console.log('✅ System audit trail initialized.');
    console.log('\n🎉 Database seeding finished successfully!\n');
    console.log('Credentials for Evaluation:');
    console.log('  Admin   : admin@citycare.com   / admin123456');
    console.log('  Staff   : staff@citycare.com   / staff123456');
    console.log('  Citizen : citizen@citycare.com / citizen123456');
}

main()
    .catch((e) => {
        console.error('❌ Seeding error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
