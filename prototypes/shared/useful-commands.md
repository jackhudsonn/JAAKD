# Useful Commands

## Seaching for keywords

Use the following command to search the entire codebase for a keyword. If you'd like to 

```bash
grep -RIn --exclude-dir={node_modules,dist,build,target,.git,.idea,.angular,prototypes}
 --include=\*.{ts,js,java,html,css,md,yml} "YOUR_KEYWORD" .
```
