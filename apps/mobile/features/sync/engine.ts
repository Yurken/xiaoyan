import { propfindFiles, webdavRequest, type WebdavConfig } from "../webdav/client";
import { decryptSyncJson } from "./crypto";
import { applyChanges, getLocalClocks } from "./localStore";
import { mergeSnapshots } from "./merge";
import { CONSUMED_TABLES, recordKey, type DeviceSnapshot, type SyncSummary } from "./types";

const DEVICES_DIR = "/xiaoyan-sync/devices";

/**
 * 拉取式同步：列出 WebDAV 上所有设备快照 → 解密 → 合并 → 落本地缓存库。
 * 移动端只消费、不产生数据，因此不上传、不做删除检测，只把桌面端的数据同步过来。
 */
export async function pullSync(config: WebdavConfig, password: string): Promise<SyncSummary> {
  const files = await propfindFiles(config, DEVICES_DIR);
  const snapshotFiles = files.filter((file) => file.name.endsWith(".rcstate"));

  const snapshots: DeviceSnapshot[] = [];
  for (const file of snapshotFiles) {
    const resp = await webdavRequest(config, "GET", `${DEVICES_DIR}/${file.name}`);
    if (resp.status >= 300 || !resp.body) continue;
    try {
      snapshots.push(decryptSyncJson<DeviceSnapshot>(resp.body, password));
    } catch {
      // 跳过无法解密/解析的文件（密码不符或损坏），不中断整体同步。
    }
  }

  if (snapshots.length === 0) {
    return { devices: 0, applied: 0, deleted: 0 };
  }

  const localClocks = new Map<string, string>();
  for (const table of CONSUMED_TABLES) {
    const clocks = await getLocalClocks(table);
    for (const [pk, ts] of clocks) localClocks.set(recordKey(table, pk), ts);
  }

  const plan = mergeSnapshots(snapshots, localClocks);
  const { applied, deleted } = await applyChanges(plan.upserts, plan.deletes);
  return { devices: snapshots.length, applied, deleted };
}
