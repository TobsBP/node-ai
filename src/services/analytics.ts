import { tickets_collection } from '@/lib/mongo.js';
import type {
	AnalyticsResponse,
	CategoryStat,
	DeviceStat,
	SystemStat,
} from '@/types/analytics.js';

export const analytics_service = {
	async get_stats(): Promise<{
		data: AnalyticsResponse | null;
		error: unknown;
	}> {
		try {
			const [categories, devices, systems, total] = await Promise.all([
				tickets_collection
					.aggregate<CategoryStat>([
						{ $group: { _id: '$category', count: { $sum: 1 } } },
						{ $sort: { count: -1 } },
						{ $project: { _id: 0, category: '$_id', count: 1 } },
					])
					.toArray(),
				tickets_collection
					.aggregate<DeviceStat>([
						{ $match: { deviceModel: { $ne: null, $exists: true } } },
						{ $group: { _id: '$deviceModel', count: { $sum: 1 } } },
						{ $sort: { count: -1 } },
						{ $limit: 10 },
						{ $project: { _id: 0, deviceModel: '$_id', count: 1 } },
					])
					.toArray(),
				tickets_collection
					.aggregate<SystemStat>([
						{ $match: { system: { $ne: null, $exists: true } } },
						{ $group: { _id: '$system', count: { $sum: 1 } } },
						{ $sort: { count: -1 } },
						{ $project: { _id: 0, system: '$_id', count: 1 } },
					])
					.toArray(),
				tickets_collection.countDocuments(),
			]);

			return {
				data: {
					top_categories: categories,
					top_devices: devices,
					system_distribution: systems,
					total_tickets: total,
				},
				error: null,
			};
		} catch (error) {
			console.error('Error fetching analytics:', error);
			return { data: null, error };
		}
	},
};
