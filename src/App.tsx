import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, Download, ExternalLink, FileText, Mail, Trash2, UploadCloud } from 'lucide-react';
import { BindingRecord, EmailGroup } from './types';
import { parseTextBlocks } from './lib/parser';

export default function App() {
  const [rawBindings, setRawBindings] = useState<BindingRecord[]>(() => {
    try {
      const saved = localStorage.getItem('usor_raw_bindings');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [welcomeSet, setWelcomeSet] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('usor_welcome_set');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [dragActive, setDragActive] = useState(false);
  const [copiedGroup, setCopiedGroup] = useState<string | null>(null);
  const [copiedCol, setCopiedCol] = useState(false);
  const [copiedEmailCol, setCopiedEmailCol] = useState(false);
  const [copiedAllPairs, setCopiedAllPairs] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('usor_raw_bindings', JSON.stringify(rawBindings));
      localStorage.setItem('usor_welcome_set', JSON.stringify(Array.from(welcomeSet)));
    } catch {}
  }, [rawBindings, welcomeSet]);

  useEffect(() => {
    const handleDocumentDrag = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'none';
    };

    window.addEventListener('dragenter', handleDocumentDrag, false);
    window.addEventListener('dragover', handleDocumentDrag, false);
    window.addEventListener('dragleave', handleDocumentDrag, false);
    window.addEventListener('drop', handleDocumentDrag, false);

    return () => {
      window.removeEventListener('dragenter', handleDocumentDrag);
      window.removeEventListener('dragover', handleDocumentDrag);
      window.removeEventListener('dragleave', handleDocumentDrag);
      window.removeEventListener('drop', handleDocumentDrag);
    };
  }, []);

  const processFiles = async (files: File[]) => {
    const allBindings: BindingRecord[] = [];
    const allWelcomeEmails = new Set<string>();

    for (const file of files) {
      try {
        const text = await file.text();
        const { bindings, newWelcomeEmails } = parseTextBlocks(text);

        allBindings.push(
          ...bindings.map((binding) => ({
            id: crypto.randomUUID(),
            ...binding,
          })),
        );
        newWelcomeEmails.forEach((email) => allWelcomeEmails.add(email));
      } catch (error) {
        console.error(`Error parsing file ${file.name}:`, error);
      }
    }

    setRawBindings((prev) => [...prev, ...allBindings]);
    if (allWelcomeEmails.size > 0) {
      setWelcomeSet((prev) => {
        const nextSet = new Set(prev);
        allWelcomeEmails.forEach((email) => nextSet.add(email));
        return nextSet;
      });
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files.length > 0) {
      await processFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const groupedData: EmailGroup[] = useMemo(() => {
    const sortedBindings = [...rawBindings].sort((a, b) => a.account.localeCompare(b.account));
    const map = new Map<string, EmailGroup>();

    for (const binding of sortedBindings) {
      if (!map.has(binding.account)) {
        map.set(binding.account, {
          account: binding.account,
          isNewCustomer: welcomeSet.has(binding.account),
          bindings: [],
        });
      }
      map.get(binding.account)!.bindings.push(binding);
    }

    return Array.from(map.values());
  }, [rawBindings, welcomeSet]);

  const writeClipboard = async (value: string) => {
    await navigator.clipboard.writeText(value);
  };

  const handleClearData = () => {
    setRawBindings([]);
    setWelcomeSet(new Set());
    localStorage.removeItem('usor_raw_bindings');
    localStorage.removeItem('usor_welcome_set');
  };

  const handleCopyGroup = async (group: EmailGroup) => {
    await writeClipboard(group.account);
    setCopiedGroup(group.account);
    setTimeout(() => setCopiedGroup(null), 2000);
  };

  const handleCopyAllEmails = async () => {
    const emails = groupedData.flatMap((group) => group.bindings.map(() => group.account));
    await writeClipboard(emails.join('\n'));
    setCopiedEmailCol(true);
    setTimeout(() => setCopiedEmailCol(false), 2000);
  };

  const handleCopyAllIds = async () => {
    const ids = groupedData.flatMap((group) => group.bindings.map((binding) => binding.qrCodeId));
    await writeClipboard(ids.join('\n'));
    setCopiedCol(true);
    setTimeout(() => setCopiedCol(false), 2000);
  };

  const handleCopyAllPairs = async () => {
    const pairs = groupedData.flatMap((group) => group.bindings.map((binding) => `${binding.qrCodeId}\t${group.account}`));
    await writeClipboard(pairs.join('\n'));
    setCopiedAllPairs(true);
    setTimeout(() => setCopiedAllPairs(false), 2000);
  };

  const handleExportCSV = () => {
    let csvContent = '邮箱,客户类型,目标链接,二维码ID,邮件发送时间\n';

    groupedData.forEach((group) => {
      const customerType = group.isNewCustomer ? 'new' : 'old';
      group.bindings.forEach((binding) => {
        csvContent += [
          `"${group.account}"`,
          `"${customerType}"`,
          `"${binding.targetUrl}"`,
          `"${binding.qrCodeId}"`,
          `"${binding.date}"`,
        ].join(',') + '\n';
      });
    });

    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Review_Bindings_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50 font-sans text-gray-900">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-600">
            <Mail className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-gray-900">
            邮件数据提取 <span className="ml-2 text-sm font-normal text-gray-500">Data Extractor</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="mr-2 text-sm text-gray-600">
            提取 <span className="font-bold text-blue-600">{groupedData.length}</span> 个邮箱，
            <span className="font-bold text-blue-600">{rawBindings.length}</span> 条记录
          </div>
          <button
            type="button"
            onClick={handleCopyAllPairs}
            disabled={rawBindings.length === 0}
            className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 disabled:opacity-50"
            title="复制格式：二维码ID + 邮箱"
          >
            {copiedAllPairs ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            一键复制
          </button>
          <button
            type="button"
            onClick={handleClearData}
            disabled={rawBindings.length === 0}
            className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-red-600 transition-all hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            清除
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={rawBindings.length === 0}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            导出 CSV
          </button>
        </div>
      </header>

      <main className="flex min-h-0 max-w-full flex-1 flex-col gap-4 overflow-hidden p-4">
        <section
          className={`relative flex shrink-0 items-center justify-center rounded-lg border-2 border-dashed p-4 transition-colors ${
            dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:bg-gray-50'
          }`}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            multiple
            accept=".eml,.txt,.csv"
            onChange={handleFileChange}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <div className="pointer-events-none flex items-center gap-3">
            <UploadCloud className={`h-6 w-6 ${dragActive ? 'text-blue-500' : 'text-gray-400'}`} />
            <p className="text-sm font-medium text-gray-700">点击此处或拖拽多个文件至此处进行解析 (Upload .eml / .txt)</p>
          </div>
        </section>

        <section className="relative flex min-h-0 flex-1 flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex-1 overflow-auto">
            <table className="w-full min-w-[1390px] table-fixed border-collapse whitespace-nowrap text-left text-sm">
              <colgroup>
                <col className="w-[150px]" />
                <col className="w-[80px]" />
                <col className="w-[740px]" />
                <col className="w-[280px]" />
                <col className="w-[140px]" />
              </colgroup>
              <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">
                    <div className="flex items-center gap-2">
                      邮箱
                      {rawBindings.length > 0 && (
                        <button onClick={handleCopyAllEmails} className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-200" title="复制整列邮箱">
                          {copiedEmailCol ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </th>
                  <th className="px-3 py-3 text-xs font-semibold uppercase text-gray-500">客户类型</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase text-gray-500">目标链接 (Target URL)</th>
                  <th className="px-3 py-3 text-xs font-semibold uppercase text-gray-500">
                    <div className="flex items-center gap-2">
                      二维码ID (QR ID)
                      {rawBindings.length > 0 && (
                        <button onClick={handleCopyAllIds} className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-200" title="复制整列二维码ID">
                          {copiedCol ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </th>
                  <th className="px-3 py-3 text-xs font-semibold uppercase text-gray-500">邮件发送时间</th>
                </tr>
              </thead>
              <tbody>
                {groupedData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <FileText className="h-10 w-10 text-gray-300" />
                        <p>暂无数据。请拖拽或选择邮件文件开始解析。</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  groupedData.map((group, groupIndex) => (
                    <React.Fragment key={`${group.account}-${groupIndex}`}>
                      {group.bindings.map((binding, bindingIndex) => {
                        const isLastInGroup = bindingIndex === group.bindings.length - 1;
                        const isFirstInGroup = bindingIndex === 0;

                        return (
                          <tr key={binding.id} className="group/row transition-colors hover:bg-gray-50/50">
                            <td className={`border-r border-gray-100 bg-white px-4 py-3 align-top ${isLastInGroup ? 'border-b border-gray-100' : ''}`}>
                              <div className="flex min-w-0 items-center gap-2">
                                <span
                                  className={`min-w-0 flex-1 truncate font-medium ${isFirstInGroup ? 'select-all text-gray-900' : 'select-text text-transparent'}`}
                                  title={isFirstInGroup ? group.account : undefined}
                                >
                                  {group.account}
                                </span>
                                {isFirstInGroup && (
                                  <button
                                    type="button"
                                    onClick={() => handleCopyGroup(group)}
                                    className="rounded p-1 text-gray-400 opacity-0 transition-colors hover:bg-gray-100 hover:text-gray-600 group-hover/row:opacity-100"
                                    title="复制该邮箱"
                                  >
                                    {copiedGroup === group.account ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className={`border-r border-gray-100 bg-white px-3 py-3 align-top ${isLastInGroup ? 'border-b border-gray-100' : ''}`}>
                              <span
                                className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-bold transition-none ${
                                  isFirstInGroup
                                    ? group.isNewCustomer
                                      ? 'border-green-200 bg-green-100 text-green-800'
                                      : 'border-red-200 bg-red-100 text-red-800'
                                    : 'select-text border-transparent bg-transparent text-transparent'
                                }`}
                              >
                                {group.isNewCustomer ? 'new' : 'old'}
                              </span>
                            </td>
                            <td className="border-b border-gray-100 px-4 py-3 align-top">
                              <a href={binding.targetUrl} target="_blank" rel="noreferrer" className="flex min-w-0 items-center justify-start gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline">
                                <span className="min-w-0 flex-1 truncate" title={binding.targetUrl}>{binding.targetUrl}</span>
                                <ExternalLink className="h-3 w-3 shrink-0" />
                              </a>
                            </td>
                            <td className="truncate border-b border-gray-100 px-3 py-3 align-top font-mono text-xs text-gray-600" title={binding.qrCodeId}>{binding.qrCodeId}</td>
                            <td className="truncate border-b border-gray-100 px-3 py-3 align-top text-sm text-gray-500" title={binding.date}>{binding.date}</td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
