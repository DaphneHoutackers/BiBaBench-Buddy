import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Image, Check } from 'lucide-react';
import html2canvas from 'html2canvas';

export default function CopyImageButton({ targetRef, label = "Copy Image" }) {
  const [copied, setCopied] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const handleCopyImage = async () => {
    if (!targetRef.current || isCapturing) return;
    
    setIsCapturing(true);
    try {
      const canvas = await html2canvas(targetRef.current, {
        backgroundColor: '#ffffff', // Ensure white background for tables
        scale: 2, // Higher resolution
        logging: false,
        useCORS: true
      });

      canvas.toBlob(async (blob) => {
        if (!blob) throw new Error('Canvas conversion failed');
        
        try {
          const item = new window.ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (clipboardErr) {
          console.error("Clipboard API error:", clipboardErr);
          // Fallback if Clipboard API fails or is not supported for images
          alert("Could not copy image directly to clipboard. You can right-click and save the canvas if needed.");
        }
      }, 'image/png');
    } catch (err) {
      console.error("html2canvas error:", err);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopyImage}
      disabled={isCapturing}
      className="text-slate-600 border-slate-200 hover:bg-slate-50 gap-2"
    >
      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Image className="w-4 h-4" />}
      {copied ? 'Copied!' : (isCapturing ? 'Capturing...' : label)}
    </Button>
  );
}
