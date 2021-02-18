import path from "path";
import fs from "fs";
import { promisify } from "util";
import React from "react";
import ReactDOMServer from "react-dom/server";
import glob from "glob";
import matter, { GrayMatterFile } from "gray-matter";
import _ from "lodash";
import renderMdxToString from "next-mdx-remote/render-to-string";
import { components as mdxComponents } from "src/mdxComponents";
import { mapSeriesAsync } from "src/util/promise";
import { getProjectPath, renderTemplate } from "src/util/index";
import { PostFromHtml } from "src/components";
import { pages as PAGES } from "src/pages/_exports";
import * as COMPONENTS from "src/components";
import * as siteData from "./types/siteData";

type Page = typeof PAGES[0];
type File = {
  path: string;
  content: string;
};
type SiteInput = {
  pages: Page[];
  mdxFileNames: string[];
};

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const globAsync = promisify(glob);

const TEMPLATES = {
  pageHtml: fs.readFileSync(
    getProjectPath("src/templates/page.html.template"),
    {
      encoding: "utf8",
    }
  ),
  pageHydrate: fs.readFileSync(
    getProjectPath("src/templates/pageHydrate.tsx.template"),
    {
      encoding: "utf8",
    }
  ),
  post: fs.readFileSync(getProjectPath("src/templates/Post.tsx.template"), {
    encoding: "utf8",
  }),
};

function getTitle(pageTitle: string): string {
  return `${pageTitle} - kimmo.blog`;
}

function getFilesForOneReactPage(
  page: Page,
  siteData: siteData.SiteData
): File[] {
  const fileName = page.name.toLowerCase();
  const pageHydrateName = `${fileName}-hydrate`;
  const htmlContent = ReactDOMServer.renderToString(
    <page.Component data={siteData} />
  );
  const relativePathToRoot = "./";
  const html = renderTemplate(TEMPLATES.pageHtml, {
    title: getTitle(page.title),
    description: page.description,
    keywords: page.tags.join(", "),
    htmlContent,
    hydrateScriptPath: `./${pageHydrateName}.js`,
    relativePathToRoot,
    headAfterAll: "",
    bodyBeforeHydrate: "",
  });

  const pageHydrateContent = renderTemplate(TEMPLATES.pageHydrate, {
    pageImportPath: `../src/pages/${fileName}`,
    relativePathToRoot,
  });

  return [
    {
      path: `${fileName}.html`,
      content: html,
    },
    {
      path: `${pageHydrateName}.tsx`,
      content: pageHydrateContent,
    },
  ];
}

function getFilesForReactPages(
  pages: Page[],
  siteData: siteData.SiteData
): File[] {
  return _.flatten(
    pages.map((page) => getFilesForOneReactPage(page, siteData))
  );
}

async function parseMdxFile(
  mdxFileName: string
): Promise<GrayMatterFile<string>> {
  const mdxContent = await readFileAsync(
    getProjectPath(`posts/${mdxFileName}`),
    {
      encoding: "utf8",
    }
  );
  const matterMdx = matter(mdxContent);
  return matterMdx;
}

async function getFilesForOneMdxPage(mdxFileName: string): Promise<File[]> {
  const matterMdx = await parseMdxFile(mdxFileName);
  const renderedMdxSource = await renderMdxToString(matterMdx.content, {
    components: {
      ...COMPONENTS,
      ...mdxComponents,
    },
  });
  const postName = path.basename(mdxFileName, ".mdx").toLowerCase();
  const postPageTsxContent = renderTemplate(TEMPLATES.post, {
    renderedOutputPath: `./renderedOutput.txt`,
    compiledSourcePath: `./compiledSource.txt`,
  });

  const pageHydrateName = `${postName}-post-hydrate`;
  const htmlContent = ReactDOMServer.renderToString(
    <PostFromHtml html={renderedMdxSource.renderedOutput} />
  );

  const relativePathToRoot = "../../";
  const html = renderTemplate(TEMPLATES.pageHtml, {
    title: getTitle(matterMdx.data.title),
    description: matterMdx.data.description,
    keywords: matterMdx.data.tags.join(","),
    htmlContent,
    hydrateScriptPath: `./${pageHydrateName}.js`,
    relativePathToRoot,
    headAfterAll: `<link rel="stylesheet" href="${relativePathToRoot}prism-duotone-light.css" />`,
    bodyBeforeHydrate: `<script src="${relativePathToRoot}prism.js"></script>`,
  });

  const postFileName = `${postName}-post`;
  const pageHydrateContent = renderTemplate(TEMPLATES.pageHydrate, {
    pageImportPath: `./${postFileName}`,
    relativePathToRoot,
  });

  return [
    {
      path: `posts/${matterMdx.data.slug}/renderedOutput.txt`,
      content: renderedMdxSource.renderedOutput,
    },
    {
      path: `posts/${matterMdx.data.slug}/compiledSource.txt`,
      content: renderedMdxSource.compiledSource,
    },
    {
      path: `posts/${matterMdx.data.slug}/${postFileName}.tsx`,
      content: postPageTsxContent,
    },
    {
      path: `posts/${matterMdx.data.slug}/${pageHydrateName}.tsx`,
      content: pageHydrateContent,
    },
    {
      path: `posts/${matterMdx.data.slug}/index.html`,
      content: html,
    },
  ];
}

async function getFilesForMdxPages(mdxFileNames: string[]): Promise<File[]> {
  const files = await mapSeriesAsync(mdxFileNames, getFilesForOneMdxPage);
  return _.flatten(files);
}

async function getSiteData(input: SiteInput): Promise<siteData.SiteData> {
  const parsedFiles = await mapSeriesAsync(input.mdxFileNames, parseMdxFile);
  return {
    posts: parsedFiles.map((matterMdx) => ({
      title: matterMdx.data.title,
      createdAt: matterMdx.data.createdAt,
      slug: matterMdx.data.slug,
      tags: matterMdx.data.tags,
      description: matterMdx.data.description,
      path: `/posts/${matterMdx.data.slug}`,
    })),
    pages: input.pages.map((page) => ({
      title: page.title,
      path: `/${page.name}`,
    })),
  };
}

async function writeFiles(files: File[]): Promise<void> {
  await mapSeriesAsync(files, async (file) => {
    const absPath = getProjectPath(`output/${file.path}`);
    const relativeToOutput = path.relative(getProjectPath("."), absPath);

    if (!_.startsWith(relativeToOutput, "output")) {
      throw new Error(`File path outside output directory: ${file.path}`);
    }

    await fs.promises.mkdir(path.dirname(absPath), { recursive: true });
    await writeFileAsync(relativeToOutput, file.content, { encoding: "utf8" });
  });
}

async function main() {
  const mdxFileNames = await globAsync("*.mdx", {
    cwd: getProjectPath("posts/"),
  });
  const siteData = await getSiteData({
    pages: PAGES,
    mdxFileNames,
  });

  const files = _.flatten([
    getFilesForReactPages(PAGES, siteData),
    await getFilesForMdxPages(mdxFileNames),
    {
      path: "site-data.json",
      content: JSON.stringify(siteData, null, 2),
    },
  ]);

  await writeFiles(files);
}

if (require.main === module) {
  main().catch((err) => {
    console.log(err);
    process.exit(1);
  });
}
