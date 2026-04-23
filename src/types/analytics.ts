import { z } from 'zod';

export const category_stat_schema = z.object({
	category: z.string(),
	count: z.number(),
});

export const device_stat_schema = z.object({
	deviceModel: z.string(),
	count: z.number(),
});

export const system_stat_schema = z.object({
	system: z.string(),
	count: z.number(),
});

export const analytics_response_schema = z.object({
	top_categories: z.array(category_stat_schema),
	top_devices: z.array(device_stat_schema),
	system_distribution: z.array(system_stat_schema),
	total_tickets: z.number(),
});

export type CategoryStat = z.infer<typeof category_stat_schema>;
export type DeviceStat = z.infer<typeof device_stat_schema>;
export type SystemStat = z.infer<typeof system_stat_schema>;
export type AnalyticsResponse = z.infer<typeof analytics_response_schema>;
