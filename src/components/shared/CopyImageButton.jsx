import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Image, Check } from 'lucide-react';
import html2canvas from 'html2canvas';

export default function CopyImageButton({ targetRef, label = "Copy Image" }) {
  const [copied, setCopied] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const handleCopyImage = () => {
    if (!targetRef.current || isCapturing) return;
    if (!navigator.clipboard || !window.ClipboardItem) {
      alert("Clipboard API not supported on this device.");
      return;
    }
    
    setIsCapturing(true);
    const element = targetRef.current;
    
    try {
      const promise = new Promise((resolve, reject) => {
        html2canvas(element, {
          backgroundColor: '#ffffff',
          scale: 2,
          logging: false,
          useCORS: true,
          width: element.scrollWidth,
          height: element.scrollHeight,
          windowWidth: element.scrollWidth,
          windowHeight: element.scrollHeight
        }).then(canvas => {
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas conversion failed'));
            }
          }, 'image/png');
        }).catch(err => {
          console.error("html2canvas error:", err);
          reject(err);
        });
      });

      const item = new window.ClipboardItem({ 'image/png': promise });
      navigator.clipboard.write([item]).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(clipboardErr => {
        console.error("Clipboard API error:", clipboardErr);
        alert("Could not copy image directly to clipboard. You can right-click and save the canvas if needed.");
      }).finally(() => {
        setIsCapturing(false);
      });
    } catch (err) {
      console.error("Error creating clipboard item:", err);
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
