"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Toaster, toast } from "sonner";
import Image from "next/image";
import { useState } from "react";

export default function Home() {
  const [selfFile, setSelfFile] = useState<File | null>(null);
  const [characterFile, setCharacterFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultKey, setResultKey] = useState<string | null>(null);
  const resultUrl = resultKey ? `/api/r2/${resultKey}` : null;

  async function onSubmit() {
    if (!selfFile || !characterFile) {
      toast.error("請選擇兩張圖片");
      return;
    }
    setLoading(true);
    setProgress(10);
    try {
      const fd = new FormData();
      fd.append("self", selfFile);
      fd.append("character", characterFile);

      setProgress(35);
      const res = await fetch("/api/generate", { method: "POST", body: fd });
      setProgress(80);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "生成失敗");
      setResultKey(data.key as string);
      toast.success("生成完成");
      setProgress(100);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "發生錯誤";
      toast.error(msg);
      setProgress(0);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <Toaster richColors />
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Cosify 生成</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="self">你的照片</Label>
            <Input id="self" type="file" accept="image/*" onChange={(e) => setSelfFile(e.target.files?.[0] || null)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ch">角色圖片</Label>
            <Input id="ch" type="file" accept="image/*" onChange={(e) => setCharacterFile(e.target.files?.[0] || null)} />
          </div>
          {loading && <Progress value={progress} />}
          <div className="flex gap-2">
            <Button onClick={onSubmit} disabled={loading} className="w-full">
              {loading ? "生成中…" : "生成 Cosplay 圖片"}
            </Button>
          </div>
          {resultUrl && (
            <div className="pt-4">
              <Image src={resultUrl} alt="result" width={512} height={512} className="rounded-md" />
              <div className="mt-2 text-xs text-muted-foreground break-all">R2 Key：{resultKey}</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
