
import fs from 'fs';
const content = fs.readFileSync('c:/quimresaapp/schema_dump.prisma', 'utf16le');
process.stdout.write(content);
