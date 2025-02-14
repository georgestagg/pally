import * as vscode from 'vscode';
import * as positron from 'positron';
import * as path from 'path';

const palDisposables: vscode.Disposable[] = [];

class PalParticipant {
	readonly id = 'positron.positron-assistant.pal';
	readonly iconPath = new vscode.ThemeIcon('smiley');

	async getAgentData(): Promise<positron.ai.ChatAgentData> {
		const slashCommands = await this.getPalCommands();
		return {
			id: this.id,
			name: 'pal',
			metadata: { isSticky: false },
			fullName: 'Pal',
			isDefault: false,
			slashCommands,
			locations: ['editor'],
			disambiguation: []
		};
	}

	readonly _receiveFeedbackEventEmitter = new vscode.EventEmitter<vscode.ChatResultFeedback>();
	onDidReceiveFeedback: vscode.Event<vscode.ChatResultFeedback> = this._receiveFeedbackEventEmitter.event;

	readonly _performActionEventEmitter = new vscode.EventEmitter<vscode.ChatUserActionEvent>();
	onDidPerformAction: vscode.Event<vscode.ChatUserActionEvent> = this._performActionEventEmitter.event;

	async requestHandler(request: vscode.ChatRequest, context: vscode.ChatContext, response: vscode.ChatResponseStream, token: vscode.CancellationToken) {
		if (!request.command) {
			throw new Error('Pals must be invoked using a command');
		}

		const fileUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, `.config/pal/${request.command}.md`);
		const systemDocument = await vscode.workspace.openTextDocument(fileUri);
		let system = systemDocument.getText();

		let userDocument: vscode.TextDocument | undefined;
		let userSelection: vscode.Selection | undefined;

		const messages: vscode.LanguageModelChatMessage[] = [];
		const tools: vscode.LanguageModelChatTool[] = vscode.lm.tools.filter((tool) => tool.name === 'edit');

		if (request.location2 instanceof vscode.ChatRequestEditorData) {
			system += `When you have finished responding, you can choose to output a revised version of the selection provided by the user if required. Also include the user's original selection when using this tool. Never mention the name of the function, just use it.`;
			userDocument = request.location2.document;
			userSelection = request.location2.selection;
			const selectedText = userDocument.getText(userSelection);
			messages.push(...[
				vscode.LanguageModelChatMessage.User(`The user has selected the following text: ${selectedText}`),
				vscode.LanguageModelChatMessage.Assistant('Acknowledged.'),
			]);
		}

		const modelResponse = await request.model.sendRequest(messages, {
			tools,
			modelOptions: { system },
		}, token);

		for await (const chunk of modelResponse.stream) {
			if (token.isCancellationRequested) {
				break;
			}

			console.log(chunk);

			if (chunk instanceof vscode.LanguageModelTextPart) {
				response.markdown(chunk.value);
			} else if (chunk instanceof vscode.LanguageModelToolCallPart) {
				const input = chunk.input as { code: string };
				response.push(new vscode.ChatResponseTextEditPart(
					userDocument!.uri,
					vscode.TextEdit.replace(userSelection!, input.code)
				));
			}

		}
	}

	async getPalCommands(): Promise<positron.ai.ChatAgentSlashCommands[]> {
		if (!vscode.workspace.workspaceFolders) {
			throw new Error('No workspace folder is open');
		}

		const workspaceRoot = vscode.workspace.workspaceFolders[0].uri;
		const pattern = new vscode.RelativePattern(
			workspaceRoot,
			'.config/pal/*.md'
		);

		const files = await vscode.workspace.findFiles(pattern);
		return files.map((file) => ({
			name: path.basename(file.fsPath.replace(/\.md$/, '')),
			description: '',
		}));
	}

	dispose(): void { }
}

// Register Pal agent through a debounce
let timeout: NodeJS.Timeout | undefined;
async function registerPal(context: vscode.ExtensionContext, delay: number = 500) {
	if (timeout) {
		clearTimeout(timeout);
	}

	timeout = setTimeout(async () => {
		palDisposables.forEach((d) => d.dispose());

		const pal = new PalParticipant();
		const agentData = await pal.getAgentData();
		const disposable = await positron.ai.registerChatAgent(agentData);
		palDisposables.push(disposable);

		const participant = vscode.chat.createChatParticipant(pal.id, pal.requestHandler);
		participant.iconPath = pal.iconPath;
		palDisposables.push(participant);
	}, delay);
}

export function setupPal(context: vscode.ExtensionContext) {
	registerPal(context, 0);

	const watcher = vscode.workspace.createFileSystemWatcher(
		new vscode.RelativePattern(vscode.workspace.workspaceFolders![0], '.config/pal/*.md')
	);

	watcher.onDidCreate(uri => {
		registerPal(context);
	});

	watcher.onDidDelete(uri => {
		registerPal(context);
	});

	return watcher;
}

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(setupPal(context));
}

export function deactivate() { }
