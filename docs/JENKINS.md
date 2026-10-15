# Jenkins Setup

## Development Environment

This section describes how to configure Jenkins for the development environment.

### 1. Create the Jenkins Job

1. Open Jenkins at `<LINUX_IP_ADDRESS>:8080`.
2. Create a new **Pipeline** project.
3. Enable **This project is parameterised**.
4. Under **Pipeline**, select **Pipeline script from SCM**.
5. Set:
	- **SCM**: `Git`
	- **Repository URL**: `<repo-url>`
	- **Branch Specifier**: `feat/jenkins` (change to `main` after merge)
6. Save the job.
7. Click **Build Now** once so Jenkins detects parameters.
	- The first run may fail; this is expected.

### 2. Start SonarQube (Dev)

Run on the Linux VM:

```bash
docker ps
docker rm -f <sonarqube_container_id>   # only if SonarQube is already running
docker run -d --name SonarQube -p 9000:9000 sonarqube:community
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

## Production

_TODO: Add production Jenkins/SonarQube setup steps._
