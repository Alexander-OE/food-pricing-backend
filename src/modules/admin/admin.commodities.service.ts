// Business logic for the admin commodity list.
import { prisma } from '../../lib/prisma';

export async function listAllCommodities() {
  const commodities = await prisma.commodity.findMany({ orderBy: { name: 'asc' } });
  return commodities.map((commodity) => ({
    id: commodity.id,
    name: commodity.name,
    slug: commodity.slug,
    category: commodity.category,
    unit: commodity.unit,
  }));
}
