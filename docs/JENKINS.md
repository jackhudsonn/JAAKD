# Jenkins Setup

### 1. Create the Jenkins Job

1. Open Jenkins at `<LINUX_IP_ADDRESS>:8080`.
2. Create a new **Pipeline** project.
3. Enable **This project is parameterised**.
4. Under **Pipeline**, select **Pipeline script from SCM**.
5. Set:
	- **SCM**: `Git`
	- **Repository URL**: `<repo-url>`
	- **Branch Specifier**: `main`
6. Save the job.
7. Click **Build Now** once so Jenkins detects parameters.
	- The first run may fail; this is expected.

### 2. Start SonarQube (Dev)

Run on the Linux VM:

```bash
docker ps
docker rm -f <sonarqube_container_id>   # only if SonarQube is already running
docker run -d --name SonarQube --restart unless-stopped -p 9000:9000 sonarqube:community
```

After SonarQube starts (about 1-2 minutes), run this on Windows to create a tunnel:

```bash
ssh -N -L 9000:localhost:9000 <linux-user>@<LINUX_IP_ADDRESS>
```

Then open SonarQube, sign in, and generate a token:

- **My Account -> Security -> Generate Token**

### 3. Configure Jenkins Credentials

Add the following credentials in Jenkins:

1. Sonar token
	- **Type**: Secret Text
	- **ID**: `sonar_secret`
2. Development env file
	- **Type**: Secret File
	- **ID**: `.env.development`

### 4. Install Jenkins Tools/Plugins

1. Install plugin:
	- `SonarQube Scanner for Jenkins`
2. In **Manage Jenkins -> Tools** configure:
	- **SonarQube Scanner**
	  - Name: `SonarQube Scanner`
	  - Install automatically with the latest version
	- **NodeJS**
	  - Name: `NodeJS`
	  - Version: `22.22.3`

### 5. Configure SonarQube Server in Jenkins

In **Manage Jenkins -> System -> SonarQube servers**:

1. Name the server `SonarQube`.
2. Set authentication token credential to `sonar_secret`.

### Notes

- SonarQube Scanner will pause the pipeline and prompt you to check the dashboard before proceeding via the ssh tunnel.
- Dev Deployment will pause the pipeline and prompt you to set up the frontend ssh tunnel to access the frontend in Windows.

## Development Environment

The `Dev Deployment` stage runs the local development stack with Docker Compose on the Jenkins host.

What it does:

1. Reads the Jenkins Secret File credential `.env.development`.
2. Runs `docker-compose --env-file "$ENV_FILE" down -v` to stop/remove existing containers and volumes.
3. Runs `docker-compose --env-file "$ENV_FILE" up -d --build` to rebuild and start all services.
4. Runs `docker-compose --env-file "$ENV_FILE" ps` and `logs` for visibility.
5. Pauses with an input prompt so you can open an SSH tunnel from Windows to the frontend.

Compose network/services used in development:

1. `jaakd-frontend` on `4200`
2. `jaakd-backend` on `8081`
3. `jaakd-postgres` on `5433` (host)
4. `jaakd-kafka` on `9092`

Notes:

1. The frontend calls `/api` through the dev proxy; it does not hardcode backend hostnames in dev.
2. `down -v` is destructive for local DB volume data; this is intentional for repeatable dev resets in CI.
3. If Jenkins is remote, keep the SSH tunnel open while testing from your local browser.

## Production

Production is split across AWS services:

1. Database: Lightsail managed PostgreSQL.
2. Kafka broker: Lightsail Linux instance running Kafka in Docker.
3. Backend API: Spring Boot JAR deployed to Elastic Beanstalk.
4. Frontend SPA: Angular production build hosted in S3
5. DNS: Route 53 aliases/CNAMEs for frontend, backend, database, and Kafka hostnames.

Expected high-level flow:

1. Jenkins runs tests/analysis and builds backend + frontend artifacts.
2. Jenkins archives build products for manual release pickup.
3. Release engineer uploads backend JAR to Elastic Beanstalk from the AWS Console (`Upload and deploy`).
4. Release engineer uploads frontend static assets from `frontend/dist/my-app/browser` to the S3 website bucket.

Current manual production release inputs:

1. Backend artifact: runnable Spring Boot JAR from `backend/target` (not `.jar.original`).
2. Frontend artifact: Angular production output from `frontend/dist/my-app/browser`.
3. Runtime configuration in Beanstalk environment properties:
	- `SPRING_DATASOURCE_URL`
	- `SPRING_DATASOURCE_USERNAME`
	- `SPRING_DATASOURCE_PASSWORD`
	- `SPRING_KAFKA_BOOTSTRAP_SERVERS`
	- `APP_CORS_ALLOWED_ORIGINS`
	- `IDENTITY_PROVIDER`
	- `AUTH_COOKIE_SECURE`
	- `SPRING_PROFILES_ACTIVE`
	- `FAUXNANCE_BASE_URL`
	- `FAUXNANCE_API_KEY`

Production prerequisites before first deploy:

1. DB role/schema/grants applied on Lightsail Postgres (`backend/db/init/00-create-roles.sql`, `backend/db/init/01-schema.sql`).
2. Kafka container running on Lightsail Linux, required topics created.
3. Beanstalk environment reachable and bound to backend alias.
4. S3 website bucket reachable and bound to frontend alias.
5. Production environment values are prepared and available for manual Beanstalk configuration.

Current Jenkins production scope:

1. Builds and archives release artifacts.
2. Does not currently perform AWS CLI-driven deployment/version updates automatically.
3. AWS Console steps are performed manually after Jenkins build artifacts are produced.