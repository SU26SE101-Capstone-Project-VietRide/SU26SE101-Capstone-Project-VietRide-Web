const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

const root = process.cwd();
const templatePath = path.join(root, ".docx_work", "Report5_Test Documentation.docx");
const htmlPath = path.join(root, ".docx_work", "Report5_VietRide_Test_Documentation.html");
const outputPath = path.join(root, "Report5_VietRide_Test_Documentation.docx");

const zip = new AdmZip(templatePath);
const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:altChunk r:id="report5Html"/>
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1247" w:right="1134" w:bottom="1134" w:left="1304"
        w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

const relsPath = "word/_rels/document.xml.rels";
let rels = zip.readAsText(relsPath);
rels = rels.replace(
  "</Relationships>",
  '<Relationship Id="report5Html" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk" Target="report5.html"/></Relationships>',
);

const contentTypesPath = "[Content_Types].xml";
let contentTypes = zip.readAsText(contentTypesPath);
contentTypes = contentTypes.replace(
  "</Types>",
  '<Override PartName="/word/report5.html" ContentType="text/html"/></Types>',
);

zip.updateFile("word/document.xml", Buffer.from(documentXml, "utf8"));
zip.updateFile(relsPath, Buffer.from(rels, "utf8"));
zip.updateFile(contentTypesPath, Buffer.from(contentTypes, "utf8"));
zip.addFile("word/report5.html", fs.readFileSync(htmlPath));
zip.writeZip(outputPath);

const stats = fs.statSync(outputPath);
console.log(`${outputPath}\n${stats.size} bytes`);
