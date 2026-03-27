import * as vscode from 'vscode';
import { CommitMessageGenerator } from './commitGenerator';

export function activate(context: vscode.ExtensionContext) {
    console.log('Commit Message Helper扩展已激活');

    // 注册生成提交信息命令
    const generateCommand = vscode.commands.registerCommand(
        'commitMessageHelper.generateMessage', 
        async () => {
            await generateCommitMessage();
        }
    );

    context.subscriptions.push(generateCommand);

    // 如果启用自动建议，监听Git状态变化
    const config = vscode.workspace.getConfiguration('commitMessageHelper');
    if (config.get('autoSuggest')) {
        setupAutoSuggestion(context);
    }
}

async function generateCommitMessage(): Promise<void> {
    try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('请先打开一个工作区');
            return;
        }

        const workspacePath = workspaceFolders[0].uri.fsPath;

        // 显示进度通知
        const message = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "正在分析代码变更并生成提交信息...",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            const generator = new CommitMessageGenerator();
            const commitMessage = await generator.generateCommitMessage(workspacePath);

            progress.report({ increment: 100 });
            return commitMessage;
        });

        // 显示结果并让用户选择操作
        await showCommitMessageDialog(message, workspacePath);

    } catch (error) {
        vscode.window.showErrorMessage(`生成提交信息失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function showCommitMessageDialog(message: string, workspacePath: string): Promise<void> {
    const selected = await vscode.window.showQuickPick([
        {
            label: '$(check) 使用此信息提交',
            description: message,
            detail: '将使用生成的提交信息执行Git提交',
            action: 'commit'
        },
        {
            label: '$(edit) 编辑后提交',
            description: '修改提交信息',
            detail: '在输入框中编辑提交信息',
            action: 'edit'
        },
        {
            label: '$(copy) 复制到剪贴板',
            description: '仅复制提交信息',
            detail: '将提交信息复制到剪贴板，不执行提交',
            action: 'copy'
        },
        {
            label: '$(close) 取消',
            description: '关闭对话框',
            action: 'cancel'
        }
    ], {
        placeHolder: `生成的提交信息: "${message}"`,
        ignoreFocusOut: true
    });

    if (!selected) {
        return;
    }

    switch (selected.action) {
        case 'commit':
            await executeGitCommit(workspacePath, message);
            break;
        case 'edit':
            const editedMessage = await vscode.window.showInputBox({
                value: message,
                prompt: '编辑提交信息',
                placeHolder: '请输入提交信息',
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return '提交信息不能为空';
                    }
                    return null;
                }
            });
            if (editedMessage) {
                await executeGitCommit(workspacePath, editedMessage);
            }
            break;
        case 'copy':
            await vscode.env.clipboard.writeText(message);
            vscode.window.showInformationMessage('提交信息已复制到剪贴板');
            break;
        case 'cancel':
            // 什么都不做
            break;
    }
}

async function executeGitCommit(workspacePath: string, message: string): Promise<void> {
    try {
        const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
        if (!gitExtension) {
            throw new Error('未找到Git扩展');
        }

        const api = gitExtension.getAPI(1);
        const repository = api.repositories.find((repo: any) => 
            repo.rootUri.fsPath === workspacePath
        );

        if (repository) {
            // 暂存所有更改
            await repository.add([]);
            // 提交
            await repository.commit(message);
            
            vscode.window.showInformationMessage(`提交成功: ${message}`);
        } else {
            throw new Error('未找到Git仓库');
        }
    } catch (error) {
        vscode.window.showErrorMessage(`提交失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function setupAutoSuggestion(context: vscode.ExtensionContext): void {
    // 监听Git状态变化，在适当时机自动建议
    // 这里可以添加自动建议的逻辑
    console.log('自动建议功能已启用');
}

export function deactivate() {}
