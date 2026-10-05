# ==========================================
# BSRU Student Portal — Spring Boot Backend
# ==========================================

# ---------- Build stage ----------
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

# โหลด dependencies ก่อน เพื่อให้ cache ไว้ใช้ซ้ำเมื่อแก้แค่โค้ด
COPY pom.xml .
RUN mvn -B -q dependency:go-offline

COPY src ./src
RUN mvn -B -q package -DskipTests

# ---------- Runtime stage ----------
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
