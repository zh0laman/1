import { Document, Packer, Paragraph, TextRun } from "docx";
import ExcelJS from "exceljs";
import PptxGenJS from "pptxgenjs";

export const generateTxt = (content = "") => {
    const blob = new Blob([content], { type: "text/plain" });
    return blob;
};

export const generateDocx = async (content = "") => {
    const doc = new Document({
        sections: [
            {
                properties: {},
                children: [
                    new Paragraph({
                        children: [
                            new TextRun(content || "Hello World"),
                        ],
                    }),
                ],
            },
        ],
    });

    const blob = await Packer.toBlob(doc);
    return blob;
};

export const generateXlsx = async (content = "") => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sheet 1");

    worksheet.addRow(["Hello", "World"]);
    if (content) {
        worksheet.addRow([content]);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    return blob;
};

export const generatePptx = async (content = "") => {
    const pptx = new PptxGenJS();
    const slide = pptx.addSlide();
    slide.addText(content || "Hello World", { x: 1, y: 1, fontSize: 18 });

    // Write as blob
    const blob = await pptx.write("blob");
    return blob;
};
