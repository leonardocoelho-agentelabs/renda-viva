"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, File, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface UploadZoneProps {
  onUploadComplete: () => void;
}

export function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [uploadId, setUploadId] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError("");
      setStatus("idle");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024, // 20MB
  });

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setStatus("uploading");
    setError("");

    try {
      // Obter token JWT
      const tokenResponse = await fetch("/api/auth/token");
      const { token } = await tokenResponse.json();

      const formData = new FormData();
      formData.append("file", file);

      // Upload
      const uploadResponse = await fetch("http://localhost:3001/api/uploads", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Erro ao fazer upload");
      }

      const { data } = await uploadResponse.json();
      setUploadId(data.upload_id);
      setStatus("processing");

      // Polling do status
      const pollStatus = async () => {
        const statusResponse = await fetch(
          `http://localhost:3001/api/uploads/${data.upload_id}/status`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!statusResponse.ok) {
          throw new Error("Erro ao verificar status");
        }

        const statusData = await statusResponse.json();

        if (statusData.data.status === "done") {
          setStatus("done");
          setProgress(100);
          onUploadComplete();
        } else if (statusData.data.status === "error") {
          throw new Error(statusData.data.error_message || "Erro no processamento");
        } else {
          // Atualizar progresso
          const prog = statusData.data.total_transacoes > 0
            ? Math.round((statusData.data.transacoes_processadas / statusData.data.total_transacoes) * 100)
            : 50;
          setProgress(prog);
          setTimeout(pollStatus, 3000);
        }
      };

      pollStatus();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setFile(null);
    setStatus("idle");
    setError("");
    setProgress(0);
    setUploadId(null);
  };

  return (
    <div className="space-y-4">
      {!file ? (
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
            isDragActive
              ? "border-green-500 bg-green-50"
              : "border-gray-300 hover:border-green-400"
          )}
        >
          <input {...getInputProps()} />
          <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">
            {isDragActive
              ? "Solte o arquivo aqui"
              : "Arraste um arquivo ou clique para selecionar"}
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Aceita: .csv, .pdf (máx. 20MB)
          </p>
        </div>
      ) : (
        <div className="border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <File className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>

            {status === "idle" && (
              <button
                onClick={handleRemove}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            )}
          </div>

          {status === "uploading" && (
            <div className="mt-4">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-600 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">Enviando...</p>
            </div>
          )}

          {status === "processing" && (
            <div className="mt-4">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-600 animate-pulse"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Processando transações... {progress}%
              </p>
            </div>
          )}

          {status === "done" && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700">
                ✅ Upload processado com sucesso!
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {status === "idle" && (
            <Button onClick={handleUpload} className="mt-4 w-full" loading={uploading}>
              Processar extrato
            </Button>
          )}
        </div>
      )}
    </div>
  );
}