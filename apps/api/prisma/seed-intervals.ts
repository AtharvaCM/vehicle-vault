import { PrismaClient, MaintenanceCategory } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const variantId = '80486f24-2e1a-44eb-8392-1d225d3f4af2'; // Hyundai i20 Asta

  const intervals = [
    {
      category: MaintenanceCategory.engine_oil,
      intervalKm: 10000,
      intervalMonths: 12,
      priority: 'high',
      notes: 'Manufacturer recommended for BS6 i20 engines',
    },
    {
      category: MaintenanceCategory.periodic_service,
      intervalKm: 10000,
      intervalMonths: 12,
      priority: 'high',
      notes: 'Full service including air and oil filters',
    },
    {
      category: MaintenanceCategory.brake_pads,
      intervalKm: 25000,
      intervalMonths: 24,
      priority: 'medium',
      notes: 'Check thickness during every periodic service',
    },
    {
      category: MaintenanceCategory.tyre_rotation,
      intervalKm: 5000,
      intervalMonths: 6,
      priority: 'low',
      notes: 'Recommended every 5,000 km to ensure even wear',
    },
  ];

  console.log(`Seeding service intervals for variant ${variantId}...`);

  for (const interval of intervals) {
    await prisma.serviceInterval.create({
      data: {
        variantId,
        ...interval,
      },
    });
  }

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
