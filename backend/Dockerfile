# Starts build stage from image with maven and temurin jdk
FROM maven:3.9-eclipse-temurin-21 as build
# Sets the working directory
WORKDIR /app
# Copies the Maven project files to the working directory
COPY pom.xml .
COPY .mvn .mvn
COPY mvnw .
# Makes the wrapper executable
RUN chmod +x mvnw && ./mvnw dependency:go-offline
# Copies the source code to the working directory
COPY src src
# Builds the project and packages it into a JAR file, skipping tests
RUN ./mvnw -B clean package -DskipTests

# Starts the runtime stage from an image with the Temurin JRE
FROM eclipse-temurin:21-jre
# Sets the working directory
WORKDIR /app
# Creates a non-root user and group for running the application
RUN addgroup -r spring && adduser -r -g spring spring
# Switches to the non-root user
USER spring:spring
# Copies the built JAR file from the build stage
COPY --from=build /app/target/*.jar app.jar
# Exposes the application port
EXPOSE 8081
# Sets the entry point for the container
ENTRYPOINT ["java","-jar","app.jar"]