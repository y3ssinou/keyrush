import cv2
import json
import sys
from pyzbar import pyzbar
import numpy as np

def scan_from_file(image_path):
    img = cv2.imread(image_path)
    if img is None:
        print(f"Erreur: Impossible de charger l'image {image_path}")
        return
    
    qr_codes = pyzbar.decode(img)
    
    if not qr_codes:
        print("Aucun code QR détecté dans l'image")
        return
    
    for qr in qr_codes:
        qr_data = qr.data.decode('utf-8')
        try:
            data = json.loads(qr_data)
            print("\n" + "=" * 50)
            print("Code QR détecté:")
            print(f"  Nom: {data.get('nom', 'N/A')}")
            print(f"  Session: {data.get('session', 'N/A')}")
            timestamp = data.get('timestamp')
            if timestamp:
                print(f"  Timestamp: {timestamp}")
            print("=" * 50)
        except json.JSONDecodeError:
            print(f"\nCode QR détecté (texte brut): {qr_data}")

def scan_from_camera():
    import os
    headless = os.environ.get('DISPLAY') is None or os.environ.get('HEADLESS', '').lower() == 'true'
    
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("Erreur: Impossible d'ouvrir la webcam", file=sys.stderr)
        sys.exit(1)
    
    if not headless:
        print("Webcam activée. Placez le code QR devant la caméra.", file=sys.stderr)
        print("Appuyez sur 'q' pour quitter", file=sys.stderr)
    
    max_attempts = 300
    attempts = 0
    
    while attempts < max_attempts:
        ret, frame = cap.read()
        
        if not ret:
            print("Erreur: Impossible de lire la webcam", file=sys.stderr)
            break
        
        qr_codes = pyzbar.decode(frame)
        
        for qr in qr_codes:
            qr_data = qr.data.decode('utf-8')
            
            try:
                data = json.loads(qr_data)
                nom = data.get('nom', 'N/A')
                session = data.get('session', 'N/A')
                timestamp = data.get('timestamp', None)
                
                if nom != 'N/A' and session != 'N/A':
                    result = {"nom": nom, "session": session}
                    if timestamp:
                        result["timestamp"] = timestamp
                    print(json.dumps(result))
                    cap.release()
                    if not headless:
                        cv2.destroyAllWindows()
                    sys.exit(0)
                
            except json.JSONDecodeError:
                pass
        
        if not headless:
            for qr in qr_codes:
                points = qr.polygon
                if len(points) == 4:
                    pts = np.array([(p.x, p.y) for p in points], dtype=np.int32)
                    cv2.polylines(frame, [pts], True, (0, 255, 0), 2)
            cv2.imshow('Scanner QR Code - Appuyez sur Q pour quitter', frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
        
        attempts += 1
    
    cap.release()
    if not headless:
        cv2.destroyAllWindows()
    print("Erreur: Aucun QR code détecté", file=sys.stderr)
    sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
        scan_from_file(image_path)
    else:
        scan_from_camera()
