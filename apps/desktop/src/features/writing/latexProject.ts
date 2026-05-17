import { DEFAULT_PROJECT_NAME, type LatexProjectFile, type WritingExportTarget, type WritingProjectSnapshot } from "./shared";

export function sanitizeLatexProjectName(value: string): string {
  const sanitized = value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return sanitized || DEFAULT_PROJECT_NAME;
}

export function buildLatexProjectFiles(project: WritingProjectSnapshot, target: WritingExportTarget): LatexProjectFile[] {
  const projectName = sanitizeLatexProjectName(project.projectName);
  const mainTex = ensureMagicComments(project.mainTex, target).trimEnd();
  const bibtex = project.bibtex.trimEnd();
  const notes = project.notes.trim();

  return [
    { path: "main.tex", content: `${mainTex}\n` },
    { path: "references.bib", content: bibtex ? `${bibtex}\n` : "% Add BibTeX entries here.\n" },
    { path: "latexmkrc", content: "$pdf_mode = 1;\n$pdflatex = 'xelatex -interaction=nonstopmode %O %S';\n" },
    { path: "figures/.gitkeep", content: "" },
    {
      path: "notes/writing-notes.md",
      content: notes ? `${notes}\n` : "# Writing Notes\n\n- TODO: Add revision notes.\n",
    },
    {
      path: "README.md",
      content: buildExportReadme(projectName, target),
    },
  ];
}

function ensureMagicComments(source: string, target: WritingExportTarget): string {
  const lines = source.trimStart().split("\n");
  const hasProgram = lines.slice(0, 6).some((line) => line.includes("!TeX program"));
  const hasRoot = lines.slice(0, 6).some((line) => line.includes("!TeX root"));
  const prefix: string[] = [];
  if (!hasProgram) prefix.push("% !TeX program = xelatex");
  if (!hasRoot) prefix.push("% !TeX root = main.tex");
  if (target === "texstudio") prefix.push("% TeXstudio: root = main.tex");
  return prefix.length > 0 ? `${prefix.join("\n")}\n${source.trimStart()}` : source;
}

function buildExportReadme(projectName: string, target: WritingExportTarget): string {
  const targetLine =
    target === "overleaf"
      ? "Upload this zip to Overleaf with New Project -> Upload Project. The root file is `main.tex`."
      : "Unzip the package, open `main.tex` in TeXstudio, and compile with XeLaTeX or latexmk.";

  return `# ${projectName}

${targetLine}

## Files

- \`main.tex\`: paper source
- \`references.bib\`: BibTeX database
- \`latexmkrc\`: XeLaTeX build profile
- \`figures/\`: place images here
- \`notes/writing-notes.md\`: drafting notes from XiaoYan

## Build

Use XeLaTeX. If your template does not need Chinese support, you can replace \`ctexart\` with the venue class file later.
`;
}
