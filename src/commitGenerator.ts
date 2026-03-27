import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as vscode from 'vscode';

const execAsync = promisify(exec);

export interface GitChange {
    filePath: string;
    changeType: 'added' | 'modified' | 'deleted' | 'renamed';
    status: string;
}

export interface ChangeAnalysis {
    fileType: string;
    likelyPurpose: string;
    complexity: 'simple' | 'moderate' | 'complex';
}

export class CommitMessageGenerator {
    async generateCommitMessage(workspacePath: string): Promise<string> {
        try {
            const changes = await this.analyzeGitChanges(workspacePath);
            
            if (changes.files.length === 0) {
                return '没有检测到代码变更';
            }

            const config = vscode.workspace.getConfiguration('commitMessageHelper');
            const useAI = config.get('aiModel') === 'ai-enhanced';

            if (useAI) {
                return await this.generateWithAI(changes);
            } else {
                return this.generateWithRules(changes);
            }
        } catch (error) {
            throw new Error(`分析Git变更失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async analyzeGitChanges(workspacePath: string): Promise<{ files: GitChange[], diff: string }> {
        try {
            const [statusResult, diffResult] = await Promise.all([
                execAsync('git status --porcelain', { cwd: workspacePath }),
                execAsync('git diff --staged', { cwd: workspacePath })
            ]);

            const files = this.parseGitStatus(statusResult.stdout);
            const diff = diffResult.stdout;

            return { files, diff };
        } catch (error) {
            // 如果git命令失败，尝试使用VSCode的API
            return await this.analyzeWithVSCodeAPI(workspacePath);
        }
    }

    private parseGitStatus(statusOutput: string): GitChange[] {
        const files: GitChange[] = [];
        const lines = statusOutput.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
            const status = line.substring(0, 2).trim();
            const filePath = line.substring(3);
            
            let changeType: GitChange['changeType'] = 'modified';
            if (status === '??') changeType = 'added';
            else if (status.startsWith('D')) changeType = 'deleted';
            else if (status.startsWith('R')) changeType = 'renamed';
            
            files.push({
                filePath,
                changeType,
                status
            });
        }
        
        return files;
    }

    private async analyzeWithVSCodeAPI(workspacePath: string): Promise<{ files: GitChange[], diff: string }> {
        // 使用VSCode的Git API作为备选方案
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (!gitExtension) {
            throw new Error('Git扩展不可用');
        }

        const api = gitExtension.exports.getAPI(1);
        const repository = api.repositories.find((repo: any) => 
            repo.rootUri.fsPath === workspacePath
        );

        if (!repository) {
            throw new Error('未找到Git仓库');
        }

        const changes = repository.state.workingTreeChanges;
        const files: GitChange[] = changes.map((change: any) => ({
            filePath: change.uri.fsPath,
            changeType: this.mapVSCodeChangeType(change.status),
            status: change.status.toString()
        }));

        return { files, diff: '' };
    }

    private mapVSCodeChangeType(status: number): GitChange['changeType'] {
        switch (status) {
            case 1: return 'added';
            case 2: return 'deleted';
            case 3: return 'modified';
            default: return 'modified';
        }
    }

    private generateWithRules(changes: { files: GitChange[], diff: string }): string {
        if (changes.files.length === 0) {
            return '没有变更可提交';
        }

        if (changes.files.length === 1) {
            const file = changes.files[0];
            const purpose = this.guessChangePurpose(file.filePath, changes.diff);
            const fileName = path.basename(file.filePath);
            return `${purpose}: ${fileName}`;
        } else {
            const mainPurpose = this.analyzeMainPurpose(changes.files);
            return `${mainPurpose} (${changes.files.length}个文件)`;
        }
    }

    private async generateWithAI(changes: { files: GitChange[], diff: string }): Promise<string> {
        // 简化版AI生成 - 实际项目中可以集成真正的AI服务
        const ruleBasedMessage = this.generateWithRules(changes);
        
        // 这里可以添加AI增强逻辑
        // 例如调用OpenAI API或其他NLP服务
        
        return `AI优化: ${ruleBasedMessage}`;
    }

    private guessChangePurpose(filePath: string, diff: string): string {
        const ext = path.extname(filePath).toLowerCase();
        const diffLower = diff.toLowerCase();

        const purposeMap: { [key: string]: string } = {
            '.js': '前端修改',
            '.ts': 'TypeScript修改',
            '.tsx': 'React组件修改',
            '.jsx': 'React组件修改',
            '.py': 'Python代码修改',
            '.java': 'Java代码修改',
            '.cpp': 'C++代码修改',
            '.html': '页面结构更新',
            '.css': '样式优化',
            '.scss': '样式优化',
            '.md': '文档更新',
            '.json': '配置调整',
            '.yml': '配置调整',
            '.yaml': '配置调整'
        };

        let purpose = purposeMap[ext] || '代码修改';

        // 基于关键词进一步判断
        if (diffLower.includes('fix') || diffLower.includes('bug') || diffLower.includes('error')) {
            purpose = '问题修复';
        } else if (diffLower.includes('add') || diffLower.includes('create') || diffLower.includes('new')) {
            purpose = '功能添加';
        } else if (diffLower.includes('refactor') || diffLower.includes('cleanup')) {
            purpose = '代码重构';
        } else if (diffLower.includes('update') || diffLower.includes('improve')) {
            purpose = '功能优化';
        } else if (diffLower.includes('remove') || diffLower.includes('delete')) {
            purpose = '功能移除';
        }

        return purpose;
    }

    private analyzeMainPurpose(files: GitChange[]): string {
        const purposes = files.map(file => 
            this.guessChangePurpose(file.filePath, '')
        );

        const purposeCount: { [key: string]: number } = {};
        purposes.forEach(purpose => {
            purposeCount[purpose] = (purposeCount[purpose] || 0) + 1;
        });

        const mainPurpose = Object.keys(purposeCount).reduce((a, b) => 
            purposeCount[a] > purposeCount[b] ? a : b
        );

        return mainPurpose;
    }
}
