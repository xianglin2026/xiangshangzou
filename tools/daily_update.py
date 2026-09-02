#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
向上走 APP · 央国企招聘信息每日自动更新脚本

功能：
  1. 将 recruit-data.json 的 `updated` 字段更新为「今天」，
     实现「直接点开 APP 刷新就自动更新招聘信息」中的「每日更新」效果。
  2. 对带 deadlineISO（报名/截止日期，格式 YYYY-MM-DD）的条目，
     若日期已过且尚未标记「已截止」，则自动标记为「已截止」，
     使招聘状态随时间保持真实。

用法：
  python3 tools/daily_update.py
（由 .github/workflows/daily-update.yml 每天定时调用，提交并推送结果）

说明：每日运行不会改变手工整理的招聘正文；仅在「日期已过」时自动调整状态。
如要新增岗位，请在 recruit-data.json 的 data 数组中追加条目，并提交即可，
APP 打开时会自动拉取最新内容。
"""
import json
import os
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(ROOT, "recruit-data.json")


def main():
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    today = date.today()
    changed = False

    # 1) 更新「更新于」日期
    old_updated = data.get("updated")
    new_updated = today.strftime("%Y-%m-%d")
    if old_updated != new_updated:
        data["updated"] = new_updated
        changed = True
        print(f"[daily-update] updated: {old_updated} -> {new_updated}")

    # 2) 自动过期：deadlineISO 早于今天且尚未标记「截止」
    for item in data.get("data", []):
        iso = item.get("deadlineISO")
        if not iso:
            continue
        try:
            dl = date.fromisoformat(iso)
        except ValueError:
            continue
        if dl >= today:
            continue
        # 已标记截止的不再重复处理
        if "截止" in (item.get("deadlineTag", "") + item.get("title", "")):
            continue
        item["deadlineTag"] = "❌ 已截止"
        item["salaryTag"] = "已截止"
        item["matchLevel"] = "low"
        item["type"] = item.get("type", "").replace("（27届专属）", "").replace("（27届）", "") + " — 已截止"
        reason = item.get("matchReason", "")
        if "系统自动标记" not in reason:
            item["matchReason"] = (reason + " · 系统自动标记：报名/截止日期已过").strip(" ·")
        changed = True
        print(f"[daily-update] 自动标记已截止: {item.get('company')} (deadlineISO={iso})")

    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    if changed:
        print("[daily-update] 数据已更新，请提交并推送。")
        sys.exit(0)
    else:
        print("[daily-update] 无变化，今日无需提交。")


if __name__ == "__main__":
    main()
