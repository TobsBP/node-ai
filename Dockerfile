# STAGE 1: Build Stage
FROM node:20-alpine AS build

WORKDIR /usr/src/app

# Copy package files
COPY package.json package-lock.json ./

# Install ALL dependencies (including dev dependencies for build)
RUN npm i

# Copy source code and config files
COPY . .

# Build the application
RUN npm run build

# STAGE 2: Production Stage
FROM node:20-alpine AS production

ENV NODE_ENV=production
WORKDIR /usr/src/app

# Copy package files
COPY package.json package-lock.json ./

# Install ONLY production dependencies
RUN npm i

# Copy the entire dist folder from build stage
COPY --from=build /usr/src/app/dist ./dist

EXPOSE 3333

# Use node directly instead of npm start (more reliable)
CMD ["npm", "start"]