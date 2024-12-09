import sys
import os

# 獲取 src 目錄的絕對路徑
src_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))

if src_path not in sys.path:
    sys.path.append(src_path)