"use client";

import { ChevronDown, ChevronRight, ExternalLink, FileCode2, Folder, FolderOpen, LoaderCircle } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import styles from "@/components/open-source.module.css";
import {
  buildGitHubRepositoryTree,
  type GitHubRepositoryTreeEntry,
  type GitHubRepositoryTreeNode,
} from "@/lib/github-repository-browser";

type RepositoryTreeResponse = {
  branch: string;
  entries: GitHubRepositoryTreeEntry[];
  repository: string;
  repositoryUrl: string;
  truncated: boolean;
};

type RepositoryFileResponse = {
  binary: boolean;
  branch: string;
  content: string | null;
  fileUrl: string;
  path: string;
};

type OpenSourceRepositoryBrowserProps = {
  repository: string;
  repositoryUrl: string;
  slug: string;
};

const MotionLoaderCircle = motion.create(LoaderCircle);
const subscribeToNothing = () => () => {};

function RepositoryLoadingIcon() {
  const mounted = useSyncExternalStore(subscribeToNothing, () => true, () => false);
  const reduceMotion = useReducedMotion();
  const spinning = mounted && !reduceMotion;
  return (
    <MotionLoaderCircle
      animate={{ rotate: spinning ? [0, 360] : 0 }}
      aria-hidden="true"
      initial={false}
      transition={spinning ? { duration: 0.9, ease: "linear", repeat: Infinity } : { duration: 0 }}
    />
  );
}

function formatFileSize(size?: number) {
  if (size === undefined) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function RepositoryTreeRows({
  depth = 0,
  expanded,
  nodes,
  onOpenFile,
  onToggleDirectory,
  selectedPath,
}: {
  depth?: number;
  expanded: Set<string>;
  nodes: GitHubRepositoryTreeNode[];
  onOpenFile: (node: GitHubRepositoryTreeNode) => void;
  onToggleDirectory: (path: string) => void;
  selectedPath: string | null;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <ul className={styles.repositoryTree}>
      {nodes.map((node) => {
        const isDirectory = node.type === "tree";
        const isExpanded = expanded.has(node.path);
        return (
          <li key={node.path}>
            <button
              aria-current={!isDirectory && selectedPath === node.path ? "true" : undefined}
              aria-expanded={isDirectory ? isExpanded : undefined}
              className={styles.repositoryTreeItem}
              onClick={() => isDirectory ? onToggleDirectory(node.path) : onOpenFile(node)}
              style={{ paddingLeft: `${.7 + depth * .8}rem` }}
              type="button"
            >
              {isDirectory
                ? isExpanded ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />
                : <FileCode2 aria-hidden="true" />}
              {isDirectory ? isExpanded ? <FolderOpen aria-hidden="true" /> : <Folder aria-hidden="true" /> : null}
              <span>{node.name}</span>
              {!isDirectory && node.size !== undefined ? <small>{formatFileSize(node.size)}</small> : null}
            </button>
            {/* 目录展开/收起用高度动画过渡层级跳动，reduced-motion 下时长归零。 */}
            {isDirectory ? (
              <AnimatePresence initial={false}>
                {isExpanded ? (
                  <motion.div
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    initial={{ height: 0, opacity: 0 }}
                    key="children"
                    style={{ overflow: "hidden" }}
                    transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <RepositoryTreeRows
                      depth={depth + 1}
                      expanded={expanded}
                      nodes={node.children}
                      onOpenFile={onOpenFile}
                      onToggleDirectory={onToggleDirectory}
                      selectedPath={selectedPath}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function OpenSourceRepositoryBrowser({ repository, repositoryUrl, slug }: OpenSourceRepositoryBrowserProps) {
  const [tree, setTree] = useState<RepositoryTreeResponse | null>(null);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [file, setFile] = useState<RepositoryFileResponse | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const requestVersion = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/open-source/${encodeURIComponent(slug)}/repository/tree`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as RepositoryTreeResponse & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "暂时无法读取原始仓库结构。");
        setTree(result);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setTreeError(error instanceof Error ? error.message : "暂时无法读取原始仓库结构。");
      });
    return () => controller.abort();
  }, [slug]);

  const toggleDirectory = (path: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const openFile = async (node: GitHubRepositoryTreeNode) => {
    const currentVersion = requestVersion.current + 1;
    requestVersion.current = currentVersion;
    setSelectedPath(node.path);
    setFile(null);
    setFileError(null);
    setLoadingFile(true);
    try {
      const response = await fetch(`/api/open-source/${encodeURIComponent(slug)}/repository/file?path=${encodeURIComponent(node.path)}`);
      const result = await response.json() as RepositoryFileResponse & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "暂时无法读取原始文件。");
      if (requestVersion.current === currentVersion) setFile(result);
    } catch (error) {
      if (requestVersion.current === currentVersion) {
        setFileError(error instanceof Error ? error.message : "暂时无法读取原始文件。");
      }
    } finally {
      if (requestVersion.current === currentVersion) setLoadingFile(false);
    }
  };

  const nodes = tree ? buildGitHubRepositoryTree(tree.entries) : [];

  return (
    <div className={styles.repositoryBrowser}>
      <div className={styles.repositoryBrowserToolbar}>
        <div>
          <strong>{repository}</strong>
          {tree ? <span> · {tree.branch}</span> : null}
        </div>
        <a href={repositoryUrl} rel="noreferrer" target="_blank">
          在 GitHub 打开
          <ExternalLink aria-hidden="true" />
        </a>
      </div>
      {tree?.truncated ? <p className={styles.repositoryBrowserNotice}>仓库文件较多，当前仅展示前 6,000 项；可在 GitHub 查看完整结构。</p> : null}
      {treeError ? <p className={styles.repositoryBrowserError}>{treeError}</p> : null}
      {!tree && !treeError ? <p className={styles.repositoryBrowserLoading}><RepositoryLoadingIcon /> 正在读取原始仓库结构…</p> : null}
      {tree ? (
        <div className={styles.repositoryBrowserContent}>
          <aside aria-label="原始仓库文件树" className={styles.repositoryTreePane}>
            <RepositoryTreeRows
              expanded={expanded}
              nodes={nodes}
              onOpenFile={openFile}
              onToggleDirectory={toggleDirectory}
              selectedPath={selectedPath}
            />
          </aside>
          <section aria-label="原始文件内容" className={styles.repositoryFilePane}>
            {loadingFile ? <p className={styles.repositoryBrowserLoading}><RepositoryLoadingIcon /> 正在读取 {selectedPath}…</p> : null}
            {!loadingFile && fileError ? <p className={styles.repositoryBrowserError}>{fileError}</p> : null}
            {!loadingFile && !fileError && !file ? <p className={styles.repositoryFileEmpty}>从左侧文件树选择一个文本文件查看原始内容。</p> : null}
            {!loadingFile && file ? (
              <>
                <div className={styles.repositoryFileHeader}>
                  <code>{file.path}</code>
                  <a href={file.fileUrl} rel="noreferrer" target="_blank">在 GitHub 查看</a>
                </div>
                {file.binary ? (
                  <p className={styles.repositoryFileEmpty}>这是二进制文件，不能直接预览；可前往 GitHub 查看。</p>
                ) : (
                  <pre className={styles.repositoryFileContent}><code>{file.content}</code></pre>
                )}
              </>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
