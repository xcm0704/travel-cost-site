<script setup>
defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, default: function () { return [] } },
  rowKey: { type: String, default: 'id' },
  loading: { type: Boolean, default: false },
  empty: { type: String, default: '这里还没有数据' },
  minWidth: { type: Number, default: 640 }
})
</script>

<template>
  <div class="adm-table-box">
    <div class="adm-scroll">
      <table class="adm-table" :style="{ minWidth: minWidth + 'px' }">
        <thead>
          <tr>
            <th
              v-for="c in columns"
              :key="c.key"
              :class="[c.cls, c.align === 'right' ? 'adm-ta-r' : '']"
              :style="c.width ? { width: c.width } : null"
            >{{ c.label }}</th>
          </tr>
        </thead>

        <tbody v-if="loading">
          <tr v-for="n in 4" :key="'sk' + n" class="adm-skel-row">
            <td :colspan="columns.length"><span class="adm-skel"></span></td>
          </tr>
        </tbody>

        <tbody v-else-if="!rows.length">
          <tr>
            <td :colspan="columns.length"><p class="adm-empty">{{ empty }}</p></td>
          </tr>
        </tbody>

        <tbody v-else>
          <tr v-for="row in rows" :key="row[rowKey]">
            <td
              v-for="c in columns"
              :key="c.key"
              :class="[c.cls, c.align === 'right' ? 'adm-ta-r' : '', c.sticky ? 'adm-sticky' : '']"
            >
              <slot :name="c.key" :row="row" :value="row[c.key]">{{ row[c.key] }}</slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.adm-table-box {
  border: 1px solid var(--line, #e2dbcc);
  border-radius: var(--radius, 12px);
  background: var(--paper-lift, #fffdf7);
  box-shadow: var(--shadow-1, 0 1px 1px rgba(22, 39, 42, 0.04));
  overflow: hidden;
  min-width: 0;
  max-width: 100%;
}

/* 窄屏唯一出路：表格自己在容器里横向滚，页面本身不溢出 */
.adm-scroll {
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;
  max-width: 100%;
  scrollbar-width: thin;
}
.adm-scroll::-webkit-scrollbar { height: 6px; }
.adm-scroll::-webkit-scrollbar-thumb { background: var(--line-strong, #cfc6b3); border-radius: 6px; }

.adm-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13.5px;
}

.adm-table th {
  text-align: left;
  white-space: nowrap;
  font-weight: 600;
  font-size: 11.5px;
  letter-spacing: 0.14em;
  color: var(--ink-soft, #566b6d);
  background: #f3efe4;
  padding: 10px 12px;
  border-bottom: 1px solid var(--line-strong, #cfc6b3);
  position: sticky;
  top: 0;
}

.adm-table td {
  padding: 11px 12px;
  border-bottom: 1px dotted var(--line, #e2dbcc);
  color: var(--ink, #16272a);
  vertical-align: middle;
}
.adm-table tbody tr:last-child td { border-bottom: 0; }
.adm-table tbody tr:hover td { background: #f8f5ec; }

.adm-ta-r { text-align: right; }

/* 长文本（介绍/地址/备注）最多两行宽，撑不破版面 */
.adm-table td.c-clip {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 操作列钉在右边，手机横滑时按钮永远够得着 */
.adm-sticky {
  position: sticky;
  right: 0;
  background: var(--paper-lift, #fffdf7);
  box-shadow: -8px 0 12px -10px rgba(22, 39, 42, 0.5);
}
.adm-table tbody tr:hover .adm-sticky { background: #f8f5ec; }

.adm-skel-row td { padding: 12px; }
.adm-skel {
  display: block;
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(90deg, #efeade 25%, #f7f3e9 37%, #efeade 63%);
  background-size: 400% 100%;
  animation: adm-shimmer 1.3s ease infinite;
}
@keyframes adm-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }

.adm-empty {
  margin: 0;
  padding: 26px 12px;
  text-align: center;
  font-size: 13px;
  color: var(--ink-faint, #8b9a99);
}
</style>
