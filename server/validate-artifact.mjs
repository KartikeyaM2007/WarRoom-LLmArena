export function extractArtifact(raw, filename) {
  let text = raw.trim();

  const blocks = [...text.matchAll(/```[\w]*\n?([\s\S]*?)```/g)].map((match) => match[1].trim());
  if (blocks.length) {
    if (filename.endsWith(".js")) {
      text = blocks.find((block) => /document|getElementById|querySelector/.test(block)) ?? blocks[0];
    } else if (filename.endsWith(".css")) {
      text = blocks.find((block) => block.includes("{")) ?? blocks[0];
    } else {
      text = blocks.find((block) => /<html|<!DOCTYPE/i.test(block)) ?? blocks[0];
    }
  } else {
    text = text.replace(/^```[\w]*\n?/, "").replace(/\n?```$/, "").trim();
  }

  const marker =
    filename.endsWith(".js")
      ? /(?:const |let |var |function |document\.|getElementById|querySelector)/
      : filename.endsWith(".css")
        ? /[{]/
        : /<!DOCTYPE|<html/i;

  const start = text.search(marker);
  if (start > 0) {
    text = text.slice(start);
  }

  return text.trim();
}

const MIN_LEN = { html: 180, css: 120, js: 320 };

export function isValidHtml(content) {
  if (!content || content.length < MIN_LEN.html) {
    return false;
  }
  if (/^here is /i.test(content) || content.includes("```")) {
    return false;
  }
  return /<html[\s>]/i.test(content) && /<\/html>/i.test(content);
}

export function isValidCss(content) {
  if (!content || content.length < MIN_LEN.css) {
    return false;
  }
  if (/^here is /i.test(content) || content.includes("```")) {
    return false;
  }
  return content.includes("{") && content.includes("}");
}

export function isValidJs(content) {
  if (!content || content.length < MIN_LEN.js) {
    return false;
  }
  if (/^here is /i.test(content) || /for example of how you could/i.test(content)) {
    return false;
  }
  if (content.includes("```")) {
    return false;
  }
  if (!/document\.|getElementById|querySelector|addEventListener/.test(content)) {
    return false;
  }

  try {
    new Function(content);
    return true;
  } catch {
    return false;
  }
}

export function validateFile(filename, content) {
  if (filename.endsWith(".html")) {
    return isValidHtml(content);
  }
  if (filename.endsWith(".css")) {
    return isValidCss(content);
  }
  if (filename.endsWith(".js")) {
    return isValidJs(content);
  }
  return content.length > 20;
}
