import { useState, forwardRef } from 'react';
import { Button } from "@/components/ui/button";
import { Image, Check } from 'lucide-react';
import html2canvas from 'html2canvas';

const CopyImageButton = forwardRef(({ targetRef, label = "Copy Image", ...props }, ref) => {
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
    
    // Add temporary identifier to locate in cloned DOM
    element.setAttribute('data-html2canvas-target', 'true');
    const scrollWidth = element.scrollWidth;
    const scrollHeight = element.scrollHeight;
    const originalStyle = {
      width: element.style.width,
      maxWidth: element.style.maxWidth,
      overflow: element.style.overflow,
    };
    element.style.width = `${scrollWidth}px`;
    element.style.maxWidth = 'none';
    element.style.overflow = 'visible';
    
    try {
      const promise = new Promise((resolve, reject) => {
        html2canvas(element, {
          backgroundColor: '#ffffff',
          scale: 2,
          logging: false,
          useCORS: true,
          width: scrollWidth + 10, // Add slight padding to prevent edge clipping
          height: scrollHeight,
          windowWidth: scrollWidth + 10,
          windowHeight: scrollHeight,
          onclone: (clonedDoc) => {
            const clonedTarget = clonedDoc.querySelector('[data-html2canvas-target="true"]');
            if (clonedTarget) {
              clonedTarget.style.width = `${scrollWidth}px`;
              clonedTarget.style.maxWidth = 'none';
              clonedTarget.style.overflow = 'visible';
              // Only expand true scroll containers. Expanding overflow-hidden children
              // breaks compact internal grids during image capture.
              const scrollables = [clonedTarget, ...clonedTarget.querySelectorAll('.overflow-x-auto, .overflow-auto')];
              scrollables.forEach(el => {
                el.style.overflow = 'visible';
                el.style.width = `${scrollWidth}px`;
                el.style.maxWidth = 'none';
              });
            }
          }
        }).then(canvas => {
          element.removeAttribute('data-html2canvas-target');
          element.style.width = originalStyle.width;
          element.style.maxWidth = originalStyle.maxWidth;
          element.style.overflow = originalStyle.overflow;
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas conversion failed'));
            }
          }, 'image/png');
        }).catch(err => {
          element.removeAttribute('data-html2canvas-target');
          element.style.width = originalStyle.width;
          element.style.maxWidth = originalStyle.maxWidth;
          element.style.overflow = originalStyle.overflow;
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
      element.removeAttribute('data-html2canvas-target');
      element.style.width = originalStyle.width;
      element.style.maxWidth = originalStyle.maxWidth;
      element.style.overflow = originalStyle.overflow;
      setIsCapturing(false);
    }
  };

  return (
    <Button
      ref={ref}
      variant="outline"
      size="sm"
      onClick={handleCopyImage}
      disabled={isCapturing}
      className="text-slate-600 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 gap-2"
      {...props}
    >
      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Image className="w-4 h-4" />}
      {copied ? 'Copied!' : (isCapturing ? 'Capturing...' : label)}
    </Button>
  );
});

CopyImageButton.displayName = 'CopyImageButton';

export default CopyImageButton;
