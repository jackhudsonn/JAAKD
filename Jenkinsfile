pipeline {
    agent any

    parameters {
        // Environment and branch selection for the deployment
        choice(name: 'DEPLOY_ENVIRONMENT', choices: ['dev', 'prod'], description: 'Select the environment')

        if (params.DEPLOY_ENVIRONMENT == 'dev') {
            // For dev, allow selecting the branch
            properties([parameters([string(name: 'BRANCH', defaultValue: 'main', description: 'Branch to deploy')])])
        } else {
            // For prod, the branch is always main, so we can disable the BRANCH parameter
            properties([parameters([string(name: 'BRANCH', defaultValue: 'main', description: 'Branch to deploy', readonly: true)])])
        }

    }

    environment {
        IMAGE_TAG: "${params.BRANCH}-${env.BUILD_NUMBER}"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout([$class: 'GitSCM', branches: [[name: "*/${params.BRANCH}"]], userRemoteConfigs: [[url: 'git@github.com:jackhudsonn/JAAKD.git']]])
            }
        }

        stage('Backend: Static Code Analysis') {
            steps {
                // TODO: SonarQube static code analysis
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

        stage('Backend: Security Scan') {
            steps {
                owaspDependencyCheck name: 'backend-scan'
            }
            post {
                always {
                    dependencyCheckPublisher pattern: 'dependency-check-report.xml'
                }
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
                    sh 'npm prettier --check'
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
                // Remove old containers and volumes
                sh 'docker-compose down -v'

                // Start new containers
                sh 'docker-compose up -d --build'

                // Verify that the containers are running
                sh 'docker-compose ps'

                // Print the logs of the running containers
                sh 'docker-compose logs'

                // Prompt user to set up tunnel in Windows
                input message: 'ssh -N -L 4200:localhost:4200 <user>@<host>'
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
            }
        }
    }
}