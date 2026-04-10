import { fastifyCors } from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import { fastifySwagger } from '@fastify/swagger';
import ScalarApiReference from '@scalar/fastify-api-reference';
import { fastify } from 'fastify';
import {
	jsonSchemaTransform,
	serializerCompiler,
	validatorCompiler,
	type ZodTypeProvider,
} from 'fastify-type-provider-zod';

import { routes } from './router.js';

const app = fastify().withTypeProvider<ZodTypeProvider>();
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.register(fastifyMultipart);

app.register(fastifyCors, {
	origin: true,
	methods: ['GET', 'PUT', 'POST', 'PATCH', 'DELETE'],
});

app.register(fastifySwagger, {
	openapi: {
		info: {
			title: 'Node Ai',
			description: 'API to make analise tickets with vector db',
			version: '1.0.0',
		},
	},
	transform: jsonSchemaTransform,
});

app.register(ScalarApiReference, {
	routePrefix: '/docs',
});

app.register(routes);

app.listen({ port: 3333, host: '0.0.0.0' }).then(() => {
	console.log('Docs availablee at http://localhost:3333/docs');
});
