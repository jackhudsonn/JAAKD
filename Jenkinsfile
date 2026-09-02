pipeline {
    agent any

    parameters {
        choice(name: 'DEPLOY_ENV', choices: ['dev', 'prod'], description: 'Target environment for this run')
    }

    environment {
        BACKEND_IMAGE  = "jaakd-backend"
        FRONTEND_IMAGE = "jaakd-frontend" // Only used for dev
        IMAGE_TAG      = "${env.BUILD_NUMBER}"
    }

    tools {
        nodejs 'NodeJS'
    }

    stages {
        
        stage('Checkout') {
            steps {
                checkout scm
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
                dir('client') {
                    sh 'npm ci'
                    sh 'npm test -- --watch=false'
                }
            }
        }

        stage('Frontend: Lint & Format Check') {
            steps {
                dir('client') {
                    sh 'npx prettier --check .'
                    //sh 'npx eslint .'
                    //sh 'npx stylelint "**/*.css"'
                }
            }
        }

        stage('Frontend: Security Scan') {
            steps {
                dir('client') {
                    sh 'npm audit --audit-level=high'
                }
            }
        }

        stage('Backend: Build Docker Image') {
            steps {
                dir('backend') {
                    sh "docker build -t ${BACKEND_IMAGE}:${IMAGE_TAG} ."
                }
            }
        }

        // We have a lot of vulnerabilities due to outdated dependencies but we still allow the build to proceed
        stage('Backend: Scan Docker Image') {
            steps {
                sh """
                    docker run --rm \
                        -v /var/run/docker.sock:/var/run/docker.sock \
                        -v \$(pwd):/output \
                        aquasec/trivy image --format json --output /output/trivy-results.json ${BACKEND_IMAGE}:${IMAGE_TAG}
                """
            }
            post {
                always {
                    recordIssues(
                        tools: [trivy(pattern: 'trivy-results.json')],
                        qualityGates: [[threshold: 1, type: 'TOTAL_HIGH', unstable: false]]
                    )
                }
            }
        }

        // -----------------------DEV ONLY-----------------------

        stage('Dev: Build Frontend Nginx Image') {
            when { expression { params.DEPLOY_ENV == 'dev' } }
            steps {
                dir('client') {
                    sh "docker build -t ${FRONTEND_IMAGE}:${IMAGE_TAG} ."
                }
            }
        }

        stage('Dev: Archive Images') {
            when { expression { params.DEPLOY_ENV == 'dev' } }
            steps {
                sh "docker save ${BACKEND_IMAGE}:${IMAGE_TAG} -o ${BACKEND_IMAGE}_${IMAGE_TAG}.tar"
                sh "docker save ${FRONTEND_IMAGE}:${IMAGE_TAG} -o ${FRONTEND_IMAGE}_${IMAGE_TAG}.tar"
            }
            post {
                success {
                    archiveArtifacts artifacts: "${BACKEND_IMAGE}_${IMAGE_TAG}.tar,${FRONTEND_IMAGE}_${IMAGE_TAG}.tar", fingerprint: true
                }
            }
        }

        stage('Dev: Deploy Persistent Containers') {
            when { expression { params.DEPLOY_ENV == 'dev' } }
            steps {
                withCredentials ([
                    string(credentialsId: 'supabase-db-url', variable: 'SUPABASE_DB_URL'),
                    string(credentialsId: 'supabase-db-user', variable: 'SUPABASE_DB_USER'),
                    string(credentialsId: 'supabase-db-password', variable: 'SUPABASE_DB_PASSWORD'),
                    string(credentialsId: 'supabase-url', variable: 'SUPABASE_URL')
                ]) {
                sh """
                    docker network create jaakd-dev-net || true

                    docker rm -f jaakd-backend-dev jaakd-frontend-dev || true

                    docker run -d --name jaakd-backend-dev \
                        --network jaakd-dev-net \
                        --restart unless-stopped \
                        -p 8081:8081 \
                        -e SUPABASE_DB_URL=${SUPABASE_DB_URL} \
                        -e SUPABASE_DB_USER=${SUPABASE_DB_USER} \
                        -e SUPABASE_DB_PASSWORD=${SUPABASE_DB_PASSWORD} \
                        -e SUPABASE_URL=${SUPABASE_URL} \
                        -e SPRING_PROFILES_ACTIVE=dev \
                        ${BACKEND_IMAGE}:${IMAGE_TAG}

                    docker run -d --name jaakd-frontend-dev \
                        --network jaakd-dev-net \
                        --restart unless-stopped \
                        -p 8082:80 \
                        ${FRONTEND_IMAGE}:${IMAGE_TAG}

                    sleep 10
                    curl --fail http://localhost:8082/
                """
                }
            }
        }


        // -----------------------PROD ONLY-----------------------

        stage('Prod: Build Frontend') {
            when { expression { params.DEPLOY_ENV == 'prod' } }
            steps {
                dir('client') {
                    sh 'npm run build'
                }
            }
            post { // May not need to archive if we just send it to the registry
                success {
                    archiveArtifacts artifacts: 'client/dist/**', fingerprint: true
                }
            }
        }
        
        stage('Prod: Publish Frontend Artifact') {
            when { expression { params.DEPLOY_ENV == 'prod' } }
            steps {
                dir('client/dist') {
                    echo "TODO: Implement the logic to publish the frontend artifact"
                }
            }
        }

        stage('Prod: Publish Backend Image') {
            when { expression { params.DEPLOY_ENV == 'prod' } }
            steps {
                echo "TODO: Implement the logic to publish the backend image to the container registry"
            }
        }

    }

    post {
            always {
                cleanWs()
            }
            failure {
                echo "Pipeline Failed - Check the logs for details."
            }
        }

}