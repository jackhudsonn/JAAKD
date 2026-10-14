pipeline {
    agent any

    tools {
        nodejs 'NodeJS'
    }

    parameters {
        choice(name: 'DEPLOY_ENVIRONMENT', choices: ['dev', 'prod'], description: 'Select the environment')
        string(name: 'BRANCH', description: 'Branch to deploy. Prod must deploy from main only.')
    }

    environment {
        IMAGE_TAG = "${params.BRANCH ?: 'main'}-${env.BUILD_NUMBER}"
    }

    stages {
        stage('Checkout Selected Branch') {
            steps {
                script {
                    if (params.DEPLOY_ENVIRONMENT == 'prod' && params.BRANCH != 'main') {
                        error "Prod deployments must be from the main branch."
                    }
                }

                checkout([
                    $class: 'GitSCM',
                    branches: [[name: "*/${params.BRANCH}"]],
                    userRemoteConfigs: [[url: 'https://github.com/jackhudsonn/JAAKD.git']]
                ])
            }
        }

        stage('Backend: Unit Tests') {
            steps {
                dir('backend') {
                    sh 'chmod +x mvnw && ./mvnw -B clean verify'
                }
            }
            post {
                always {
                    junit 'backend/target/surefire-reports/*.xml'
                }
            }
        }

        stage('Backend: Static Code Analysis') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    script {
                        def scannerHome = tool 'SonarQube Scanner'
                        sh """
                            ${scannerHome}/bin/sonar-scanner \
                            -Dsonar.projectKey=JAAKD \
                            -Dsonar.projectName=JAAKD \
                            -Dsonar.sources=backend/src/main/java,frontend/src \
                            -Dsonar.tests=backend/src/test/java \
                            -Dsonar.java.binaries=backend/target/classes
                        """
                    }
                }

                input message: "ssh -N -L 9000:localhost:9000 <user>@<host> in Windows Terminal to access SonarQube Dashboard at http://localhost:9000"
            }
        }

        stage('Frontend: Install & Unit Tests') {
            steps {
                dir('frontend') {
                    sh 'npm ci'
                    sh 'npm test -- --watch=false'
                }
            }
        }

        stage('Frontend: Lint & Format Check') {
            steps {
                dir('frontend') {
                    sh 'npx prettier --check .'
                }
            }
        }

        stage('Frontend: Security Scan') {
            steps {
                dir('frontend') {
                    sh 'npm audit --audit-level=high'
                }
            }
        }

        // docker-compose.yml should be used for Dev deployment
        stage('Dev Deployment') {
            when {
                expression { params.DEPLOY_ENVIRONMENT == 'dev' }
            }
            steps {
                // need .env.development file in Jenkins credentials with the ID '.env.development'
                withCredentials([file(credentialsId: '.env.development', variable: 'ENV_FILE')]) {
                    // Remove old containers and volumes
                    sh 'docker-compose --env-file "$ENV_FILE" down -v'

                    // Start new containers
                    sh 'docker-compose --env-file "$ENV_FILE" up -d --build'

                    // Verify that the containers are running
                    sh 'docker-compose --env-file "$ENV_FILE" ps'

                    // Print the logs of the running containers
                    sh 'docker-compose --env-file "$ENV_FILE" logs'

                    // Prompt user to set up tunnel in Windows
                    input message: 'ssh -N -L 4200:localhost:4200 <user>@<host> in Windows Terminal to access the frontend at http://localhost:4200'
                }
            }
        }

        // Prod Requirements:
        // - S3 Bucket
        // - Beanstalk application
        // - DB connection (LightSail)
        // - Ec2 Kafka instance (LightSail)
        stage('Prod Deployment') {
            when {
                expression { params.DEPLOY_ENVIRONMENT == 'prod' }
            }
            steps {
                // TODO: Implement Prod deployment steps
                echo("Prod deployment is not yet implemented.")
            }
        }
    }
}