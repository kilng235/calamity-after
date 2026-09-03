#!/usr/bin/env node
/**
 * 灾厄之后·重制版 - YAML to JS 数据转换脚本
 * 
 * 功能：
 * 1. 将 116 个 YAML 文件转换为姬侠传格式的 JS 模块
 * 2. 检测数据薄弱点（缺失字段、空内容、格式不一致）
 * 3. 生成数据质量报告
 * 4. 输出 prompt-data-calamity.js
 * 
 * 使用：
 * node tools/convert-yaml-to-js.js
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// ==================== 配置 ====================
const CONFIG = {
  inputDir: path.join(__dirname, '..', '世界书'),
  outputDir: path.join(__dirname, '..', 'module'),
  reportDir: path.join(__dirname, '..', 'reports'),
  
  // 输出文件名
  outputs: {
    core: 'prompt-data-core-calamity.js',      // 核心提示词（系统规则）
    npc: 'prompt-data-npc-calamity.js',        // NPC 人设
    world: 'prompt-data-world-calamity.js',    // 世界观/地理/势力
    report: 'data-quality-report.md'            // 数据质量报告
  },
  
  // 姬侠传格式模板
  templates: {
    moduleHeader: `/**
 * 灾厄之后·重制版 - 自动生成的提示词数据
 * 生成时间: {{timestamp}}
 * 源文件数量: {{fileCount}}
 * 
 * 警告：此文件由脚本自动生成，请勿手动编辑
 * 如需修改，请编辑源 YAML 文件后重新运行转换脚本
 */

export const calamityPrompts = {`,
    
    moduleFooter: `};

// 导出便捷访问函数
export function getPrompt(category, key) {
  return calamityPrompts[category]?.[key] || '';
}

export function getAllPrompts(category) {
  return calamityPrompts[category] || {};
}
`
  }
};

// ==================== 数据质量检查器 ====================
class DataQualityChecker {
  constructor() {
    this.issues = {
      critical: [],   // 严重问题（缺失必填字段）
      warning: [],    // 警告（内容过短、格式不一致）
      suggestion: []  // 建议（可优化点）
    };
    this.stats = {
      totalFiles: 0,
      processedFiles: 0,
      emptyFields: 0,
      shortContent: 0,
      missingRequired: 0
    };
  }

  // 检查 NPC 数据完整性
  checkNPC(filename, data) {
    const content = this._extractText(data);
    
    // 对于 Markdown 格式，检查是否包含必要的章节标题
    const required = ['基础信息', '外貌', '性格', '背景'];
    const recommended = ['能力', '跑团接口', '战斗值', '六维'];
    
    // 检查必要章节
    for (const section of required) {
      if (!content.includes(section)) {
        this.issues.warning.push({
          file: filename,
          field: section,
          issue: '可能缺失推荐章节',
          severity: 'warning'
        });
      }
    }
    
    // 检查内容长度
    if (content.length < 500) {
      this.issues.warning.push({
        file: filename,
        issue: `内容较短（${content.length} 字），建议补充详细描述`,
        severity: 'warning'
      });
      this.stats.shortContent++;
    } else if (content.length < 200) {
      this.issues.critical.push({
        file: filename,
        issue: `内容过短（${content.length} 字），需要补充`,
        severity: 'critical'
      });
      this.stats.missingRequired++;
    }
    
    // 检查战斗数值
    if (!content.includes('HP') && !content.includes('生命值') && !content.includes('战斗值')) {
      this.issues.warning.push({
        file: filename,
        field: '战斗数值',
        issue: '缺少 HP/战斗值信息',
        severity: 'warning'
      });
    }
    
    if (!content.includes('六维') && !content.includes('力量') && !content.includes('敏捷')) {
      this.issues.warning.push({
        file: filename,
        field: '六维属性',
        issue: '缺少六维属性信息',
        severity: 'warning'
      });
    }
  }

  // 检查系统规则数据
  checkSystem(filename, data) {
    const content = this._extractText(data);
    
    if (content.length < 50) {
      this.issues.warning.push({
        file: filename,
        issue: `内容过短（${content.length} 字）`,
        severity: 'warning'
      });
      this.stats.shortContent++;
    }
    
    // 检查是否有示例
    if (filename.includes('检定') || filename.includes('战斗') || filename.includes('锻造')) {
      if (!content.includes('示例') && !content.includes('例：') && !content.includes('例子')) {
        this.issues.suggestion.push({
          file: filename,
          issue: '建议添加示例说明',
          severity: 'suggestion'
        });
      }
    }
  }

  // 检查地理/势力数据
  checkWorld(filename, data) {
    if (filename.includes('区域') || filename.includes('势力')) {
      const requiredFields = ['基本信息', '特征'];
      for (const field of requiredFields) {
        if (!this._hasContent(data, field)) {
          this.issues.warning.push({
            file: filename,
            field: field,
            issue: '缺失推荐字段',
            severity: 'warning'
          });
        }
      }
    }
  }

  // 辅助函数：检查字段是否有内容
  _hasContent(data, field) {
    if (typeof data === 'string') return data.length > 0;
    if (typeof data === 'object' && data !== null) {
      const value = data[field];
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'string') return value.trim().length > 0;
      if (typeof value === 'object' && value !== null) {
        return Object.keys(value).length > 0;
      }
      return value !== undefined && value !== null;
    }
    return false;
  }

  // 辅助函数：提取文本内容
  _extractText(data) {
    if (typeof data === 'string') return data;
    if (typeof data === 'object' && data !== null) {
      return JSON.stringify(data);
    }
    return '';
  }

  // 生成报告
  generateReport() {
    const report = {
      summary: {
        totalFiles: this.stats.totalFiles,
        processedFiles: this.stats.processedFiles,
        criticalIssues: this.issues.critical.length,
        warnings: this.issues.warning.length,
        suggestions: this.issues.suggestion.length
      },
      issues: this.issues,
      stats: this.stats
    };
    return report;
  }
}

// ==================== YAML 转换器 ====================
class YAMLConverter {
  constructor(checker) {
    this.checker = checker;
    this.data = {
      core: {},      // 核心系统规则
      npc: {},       // NPC 数据
      world: {}      // 世界观数据
    };
  }

  // 处理所有文件
  async processAll() {
    console.log('🚀 开始转换 YAML 文件...\n');
    
    // 处理 NPC
    await this.processDirectory('NPC', 'npc');
    
    // 处理系统规则
    await this.processDirectory('系统', 'core');
    
    // 处理世界观
    await this.processDirectory('世界观', 'world');
    
    // 处理地理
    await this.processDirectory('地理', 'world');
    
    // 处理其他目录
    const otherDirs = ['种族', '生物', '装备', '检定', '扮演准则', '时间线'];
    for (const dir of otherDirs) {
      await this.processDirectory(dir, 'world');
    }
    
    console.log(`\n✅ 处理完成: ${this.checker.stats.processedFiles}/${this.checker.stats.totalFiles} 个文件\n`);
  }

  // 处理单个目录
  async processDirectory(dirName, category) {
    const dirPath = path.join(CONFIG.inputDir, dirName);
    
    if (!fs.existsSync(dirPath)) {
      console.log(`⚠️  目录不存在: ${dirName}`);
      return;
    }
    
    console.log(`📁 处理目录: ${dirName}`);
    
    const files = this.getAllFiles(dirPath);
    
    for (const file of files) {
      this.checker.stats.totalFiles++;
      
      try {
        await this.processFile(file, category, dirName);
        this.checker.stats.processedFiles++;
      } catch (error) {
        console.error(`❌ 处理失败: ${path.basename(file)}`);
        console.error(`   错误: ${error.message}`);
        this.checker.issues.critical.push({
          file: path.basename(file),
          issue: `解析失败: ${error.message}`,
          severity: 'critical'
        });
      }
    }
  }

  // 递归获取所有文件
  getAllFiles(dirPath) {
    let files = [];
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        files = files.concat(this.getAllFiles(fullPath));
      } else if (item.endsWith('.yaml') || item.endsWith('.txt')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  // 处理单个文件
  async processFile(filePath, category, dirName) {
    const filename = path.basename(filePath, path.extname(filePath));
    const content = fs.readFileSync(filePath, 'utf8');
    
    let data;
    
    // 检测文件格式
    if (filePath.endsWith('.yaml')) {
      // 检查是否为 Markdown 格式（以 # 开头）
      if (content.trim().startsWith('#')) {
        // 这是 Markdown 格式的 YAML 文件，直接作为字符串处理
        data = content;
      } else {
        // 尝试作为标准 YAML 解析
        try {
          data = yaml.load(content);
        } catch (error) {
          // 解析失败，回退到字符串处理
          console.log(`   ⚠️  ${filename} YAML 解析失败，作为文本处理`);
          data = content;
        }
      }
    } else if (filePath.endsWith('.txt')) {
      data = content; // TXT 直接作为字符串
    }
    
    // 数据质量检查
    if (category === 'npc') {
      this.checker.checkNPC(filename, data);
    } else if (category === 'core') {
      this.checker.checkSystem(filename, data);
    } else if (category === 'world') {
      this.checker.checkWorld(filename, data);
    }
    
    // 存储转换后的数据
    const key = this.generateKey(filename, dirName);
    
    if (!this.data[category][dirName]) {
      this.data[category][dirName] = {};
    }
    
    this.data[category][dirName][key] = this.formatData(data, category, filename);
    
    console.log(`   ✓ ${filename}`);
  }

  // 生成键名（转为驼峰命名）
  generateKey(filename, dirName) {
    // 移除数字前缀（如 "030NPC尾铃" → "尾铃"）
    let key = filename.replace(/^\d+/, '');
    
    // 移除特殊前缀
    key = key.replace(/^NPC/, '').replace(/^区域·/, '');
    
    return key || filename;
  }

  // 格式化数据为姬侠传格式
  formatData(data, category, filename) {
    // 如果已经是字符串（Markdown 格式），直接返回
    if (typeof data === 'string') {
      return data;
    }
    
    // 转换为姬侠传的提示词格式
    if (category === 'npc') {
      return this.formatNPC(data);
    } else if (category === 'core') {
      return this.formatSystem(data);
    } else {
      return this.formatWorld(data);
    }
  }

  // 格式化 NPC 数据
  formatNPC(data) {
    const sections = [];
    
    // 基础信息
    if (data['基础信息']) {
      sections.push('## 基础信息');
      sections.push(this.objectToText(data['基础信息']));
    }
    
    // 外貌要点
    if (data['外貌要点']) {
      sections.push('\n## 外貌要点');
      sections.push(this.objectToText(data['外貌要点']));
    }
    
    // 性格与口癖
    if (data['性格与口癖']) {
      sections.push('\n## 性格与口癖');
      sections.push(this.objectToText(data['性格与口癖']));
    }
    
    // 背景与剧情钩子
    if (data['背景与剧情钩子']) {
      sections.push('\n## 背景与剧情钩子');
      sections.push(this.objectToText(data['背景与剧情钩子']));
    }
    
    // 能力与服务
    if (data['能力与服务']) {
      sections.push('\n## 能力与服务');
      sections.push(this.objectToText(data['能力与服务']));
    }
    
    // 跑团接口
    if (data['跑团接口']) {
      sections.push('\n## 跑团接口');
      sections.push(this.objectToText(data['跑团接口']));
    }
    
    return sections.join('\n');
  }

  // 格式化系统规则数据
  formatSystem(data) {
    return this.objectToText(data);
  }

  // 格式化世界观数据
  formatWorld(data) {
    return this.objectToText(data);
  }

  // 对象转文本
  objectToText(obj, indent = '') {
    if (typeof obj === 'string') return obj;
    if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
    if (obj === null || obj === undefined) return '';
    
    if (Array.isArray(obj)) {
      return obj.map(item => `${indent}- ${this.objectToText(item, indent + '  ')}`).join('\n');
    }
    
    if (typeof obj === 'object') {
      const lines = [];
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && !Array.isArray(value)) {
          lines.push(`${indent}${key}:`);
          lines.push(this.objectToText(value, indent + '  '));
        } else {
          lines.push(`${indent}${key}: ${this.objectToText(value, indent + '  ')}`);
        }
      }
      return lines.join('\n');
    }
    
    return '';
  }

  // 生成 JS 模块
  generateModules() {
    console.log('\n📝 生成 JS 模块...\n');
    
    // 确保输出目录存在
    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString();
    
    // 生成核心提示词模块
    this.writeModule('core', CONFIG.outputs.core, timestamp);
    
    // 生成 NPC 提示词模块
    this.writeModule('npc', CONFIG.outputs.npc, timestamp);
    
    // 生成世界观提示词模块
    this.writeModule('world', CONFIG.outputs.world, timestamp);
    
    console.log('✅ JS 模块生成完成\n');
  }

  // 写入模块文件
  writeModule(category, filename, timestamp) {
    const outputPath = path.join(CONFIG.outputDir, filename);
    
    // 生成模块头部
    let content = CONFIG.templates.moduleHeader
      .replace('{{timestamp}}', timestamp)
      .replace('{{fileCount}}', Object.keys(this.data[category]).length);
    
    content += '\n';
    
    // 生成数据
    for (const [dir, items] of Object.entries(this.data[category])) {
      content += `  // ${dir}\n`;
      content += `  "${dir}": {\n`;
      
      for (const [key, value] of Object.entries(items)) {
        const escapedValue = JSON.stringify(value);
        content += `    "${key}": ${escapedValue},\n`;
      }
      
      content += `  },\n\n`;
    }
    
    // 生成模块尾部
    content += CONFIG.templates.moduleFooter;
    
    fs.writeFileSync(outputPath, content, 'utf8');
    console.log(`   ✓ ${filename}`);
  }
}

// ==================== 报告生成器 ====================
class ReportGenerator {
  constructor(checker, converter) {
    this.checker = checker;
    this.converter = converter;
  }

  generate() {
    console.log('📊 生成数据质量报告...\n');
    
    // 确保报告目录存在
    if (!fs.existsSync(CONFIG.reportDir)) {
      fs.mkdirSync(CONFIG.reportDir, { recursive: true });
    }
    
    const report = this.checker.generateReport();
    const markdown = this.generateMarkdown(report);
    
    const reportPath = path.join(CONFIG.reportDir, CONFIG.outputs.report);
    fs.writeFileSync(reportPath, markdown, 'utf8');
    
    console.log(`✅ 报告已保存: ${reportPath}\n`);
    
    // 打印摘要
    this.printSummary(report);
  }

  generateMarkdown(report) {
    const lines = [];
    
    lines.push('# 灾厄之后·重制版 - 数据质量报告');
    lines.push('');
    lines.push(`> 生成时间: ${new Date().toLocaleString('zh-CN')}`);
    lines.push('');
    
    // 摘要
    lines.push('## 📊 数据摘要');
    lines.push('');
    lines.push('| 指标 | 数量 |');
    lines.push('|------|------|');
    lines.push(`| 总文件数 | ${report.summary.totalFiles} |`);
    lines.push(`| 处理成功 | ${report.summary.processedFiles} |`);
    lines.push(`| 严重问题 | ${report.summary.criticalIssues} |`);
    lines.push(`| 警告 | ${report.summary.warnings} |`);
    lines.push(`| 建议 | ${report.summary.suggestions} |`);
    lines.push('');
    
    // 严重问题
    if (report.issues.critical.length > 0) {
      lines.push('## 🚨 严重问题（需立即修复）');
      lines.push('');
      for (const issue of report.issues.critical) {
        lines.push(`- **${issue.file}**`);
        if (issue.field) lines.push(`  - 字段: ${issue.field}`);
        lines.push(`  - 问题: ${issue.issue}`);
        lines.push('');
      }
    }
    
    // 警告
    if (report.issues.warning.length > 0) {
      lines.push('## ⚠️ 警告（建议修复）');
      lines.push('');
      
      // 按文件分组
      const byFile = {};
      for (const issue of report.issues.warning) {
        if (!byFile[issue.file]) byFile[issue.file] = [];
        byFile[issue.file].push(issue);
      }
      
      for (const [file, issues] of Object.entries(byFile)) {
        lines.push(`### ${file}`);
        lines.push('');
        for (const issue of issues) {
          if (issue.field) {
            lines.push(`- **${issue.field}**: ${issue.issue}`);
          } else {
            lines.push(`- ${issue.issue}`);
          }
        }
        lines.push('');
      }
    }
    
    // 建议
    if (report.issues.suggestion.length > 0) {
      lines.push('## 💡 优化建议');
      lines.push('');
      for (const issue of report.issues.suggestion) {
        lines.push(`- **${issue.file}**: ${issue.issue}`);
      }
      lines.push('');
    }
    
    // 统计详情
    lines.push('## 📈 统计详情');
    lines.push('');
    lines.push(`- 缺失必填字段: ${report.stats.missingRequired} 处`);
    lines.push(`- 内容过短: ${report.stats.shortContent} 处`);
    lines.push(`- 空字段: ${report.stats.emptyFields} 处`);
    lines.push('');
    
    // 数据完整度评分
    const score = this.calculateScore(report);
    lines.push('## 🎯 数据完整度评分');
    lines.push('');
    lines.push(`**总分: ${score.total}/100**`);
    lines.push('');
    lines.push(`- 必填字段完整性: ${score.required}/40`);
    lines.push(`- 推荐字段完整性: ${score.recommended}/30`);
    lines.push(`- 内容质量: ${score.quality}/30`);
    lines.push('');
    
    // 建议行动
    lines.push('## 🔧 建议行动');
    lines.push('');
    if (report.summary.criticalIssues > 0) {
      lines.push('1. **优先修复严重问题**（必填字段缺失）');
    }
    if (report.summary.warnings > 10) {
      lines.push('2. **逐步完善警告项**（内容过短、格式不一致）');
    }
    if (report.summary.suggestions > 5) {
      lines.push('3. **考虑优化建议**（添加示例、丰富描述）');
    }
    lines.push('');
    
    return lines.join('\n');
  }

  calculateScore(report) {
    const total = report.summary.processedFiles;
    const critical = report.summary.criticalIssues;
    const warnings = report.summary.warnings;
    
    // 必填字段完整性（40 分）
    const required = Math.max(0, 40 - (critical * 2));
    
    // 推荐字段完整性（30 分）
    const recommended = Math.max(0, 30 - (warnings * 0.5));
    
    // 内容质量（30 分）
    const quality = Math.max(0, 30 - (report.stats.shortContent * 0.3));
    
    return {
      total: Math.round(required + recommended + quality),
      required: Math.round(required),
      recommended: Math.round(recommended),
      quality: Math.round(quality)
    };
  }

  printSummary(report) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 转换摘要');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`处理文件: ${report.summary.processedFiles}/${report.summary.totalFiles}`);
    console.log(`严重问题: ${report.summary.criticalIssues}`);
    console.log(`警告: ${report.summary.warnings}`);
    console.log(`建议: ${report.summary.suggestions}`);
    
    const score = this.calculateScore(report);
    console.log(`数据完整度: ${score.total}/100`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (report.summary.criticalIssues > 0) {
      console.log('⚠️  发现严重问题，请查看报告后修复');
    } else if (report.summary.warnings > 10) {
      console.log('⚠️  发现较多警告，建议优化数据质量');
    } else {
      console.log('✅ 数据质量良好，可以继续下一步');
    }
    console.log('');
  }
}

// ==================== 主流程 ====================
async function main() {
  try {
    console.log('\n🎮 灾厄之后·重制版 - 数据转换工具\n');
    
    // 初始化
    const checker = new DataQualityChecker();
    const converter = new YAMLConverter(checker);
    
    // 处理所有文件
    await converter.processAll();
    
    // 生成 JS 模块
    converter.generateModules();
    
    // 生成报告
    const reporter = new ReportGenerator(checker, converter);
    reporter.generate();
    
    console.log('🎉 转换完成！\n');
    
  } catch (error) {
    console.error('\n❌ 转换失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行
if (require.main === module) {
  main();
}

module.exports = { YAMLConverter, DataQualityChecker, ReportGenerator };
