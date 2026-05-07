export type JiraDev = {
	accountId: string;
	displayName: string;
	avatarUrl?: string;
};

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
			status?: {
				name: string;
				statusCategory?: { key: string };
			};
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
