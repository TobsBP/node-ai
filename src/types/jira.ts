export type JiraCreatedIssue = {
	id: string;
	key: string;
	url: string;
};

export type JiraWebhookPayload = {
	webhookEvent: string;
	issue?: {
		key: string;
		fields?: {
			status?: { name: string };
		};
	};
	changelog?: {
		items: Array<{
			field: string;
			fromString: string;
			toString: string;
		}>;
	};
};
