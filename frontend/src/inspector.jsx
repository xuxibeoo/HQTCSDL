import React, { useState, useEffect } from "react";
import { onInspectorEvent } from "./api";
import { Terminal, ChevronUp, ChevronDown, Trash2, CheckCircle2, AlertTriangle, Database } from "lucide-react";

export function LiveInspector() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    return onInspectorEvent(event => {
      setLogs(prev => [event, ...prev.slice(0, 49)]); // keep latest 50 events
    });
  }, []);

  const latest = logs[0];

  return (
    <aside className={`live-inspector-drawer ${isOpen ? "open" : "collapsed"}`} aria-label="Oracle 23ai Live SQL Inspector">
      <div className="inspector-bar">
        <div className="inspector-summary">
          <Database size={16} className="text-orange" />
          <span className="inspector-title">Oracle 23ai Live Transaction Inspector</span>
          {latest && (
            <span className="inspector-latest">
              <span className={`status-pill ${latest.isError ? "error" : "success"}`}>{latest.status}</span>
              <strong className="code-font">{latest.method} {latest.path}</strong>
              <span className="plsql-tag">{latest.plsql}</span>
              <span className="duration-tag">{latest.duration}</span>
              <span className={`tx-tag ${latest.isError ? "tx-err" : "tx-ok"}`}>{latest.txStatus}</span>
            </span>
          )}
        </div>
        <div className="inspector-controls">
          <button
            type="button"
            className="icon-btn-small"
            title="Xóa nhật ký Inspector"
            onClick={e => {
              e.stopPropagation();
              setLogs([]);
            }}
          >
            <Trash2 size={14} />
          </button>
          <button type="button" className="icon-btn-small" aria-expanded={isOpen} onClick={() => setIsOpen(open => !open)} aria-label={isOpen ? "Thu nhỏ Inspector" : "Mở rộng Inspector"}>
            {isOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="inspector-body">
          <div className="inspector-table-wrap">
            <table className="inspector-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Method & Endpoint</th>
                  <th>Đối tượng PL/SQL / View</th>
                  <th>HTTP Status</th>
                  <th>Mã kết quả</th>
                  <th>Thời gian chạy</th>
                  <th>Bind Variables / Payload</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && <tr><td colSpan={7}>Chưa có yêu cầu API được ghi nhận.</td></tr>}
                {logs.map((log, idx) => (
                  <tr key={idx} className={log.isError ? "row-error" : ""}>
                    <td className="code-font">{log.time}</td>
                    <td>
                      <span className={`method-badge ${log.method.toLowerCase()}`}>{log.method}</span>{" "}
                      <span className="code-font">{log.path}</span>
                    </td>
                    <td>
                      <strong className="plsql-name">{log.plsql}</strong>
                    </td>
                    <td>
                      <span className={`status-pill ${log.isError ? "error" : "success"}`}>
                        {log.isError ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />} {log.status}
                      </span>
                    </td>
                    <td>
                      <span className={`tx-badge ${log.isError ? "rollback" : "commit"}`}>
                        {log.txStatus}
                      </span>
                    </td>
                    <td className="code-font">{log.duration}</td>
                    <td>
                      {log.payload ? (
                        <code className="payload-json">{JSON.stringify(log.payload)}</code>
                      ) : (
                        <span className="muted">—</span>
                      )}
                      {log.error && <div className="error-note">{log.error}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </aside>
  );
}

