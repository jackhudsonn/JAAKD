# Useful Commands

## Seaching for keywords

Use the following command to search the entire codebase for a keyword.

```bash
grep -RlI --exclude-dir={node_modules,dist,build,target,.git,.angular} "YOUR_WORD" .
```

## List the longest files

Use the following command to list the top N longest files.

```bash
find src -type f \( -name "*.ts" -o -name "*.html" -o -name "*.scss" -o -name "*.css" -o -name "*.js" \) ! -path "*/node_modules/*" ! -path "*/dist/*" ! -path "*/coverage/*" ! -path "*/.angular/*" ! -path "*/.git/*" -exec wc -l {} + | sort -rn | head -n N
```

Use the following command to have fresh database and rebuild - containers will build up

```bash
docker-compose down -v && docker-compose up -d --build
```

For sonarqube

```bash

mvn clean test
mvn sonar:sonar -Dsonar.host.url=http://localhost:9000 -Dsonar.token=<get-your-sonar-token> -Dsonar.qualitygate.wait=true
```
