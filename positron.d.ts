/*---------------------------------------------------------------------------------------------
 *  Copyright (C) 2023-2024 Posit Software, PBC. All rights reserved.
 *  Licensed under the Elastic License 2.0. See LICENSE.txt for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'positron' {

	import * as vscode from 'vscode';

	/**
	 * Experimental AI features.
	 */
	namespace ai {
		/**
		 * A language model provider, c.f. vscode.LanguageModelChatProvider.
		 */
		export interface LanguageModelChatProvider {
			name: string;
			provider: string;
			identifier: string;

			/**
			 * Handle a language model request with tool calls and streaming chat responses.
			 */
			provideLanguageModelResponse(
				messages: vscode.LanguageModelChatMessage[],
				options: vscode.LanguageModelChatRequestOptions,
				extensionId: string,
				progress: vscode.Progress<{
					index: number;
					part: vscode.LanguageModelTextPart | vscode.LanguageModelToolCallPart;
				}>,
				token: vscode.CancellationToken,
			): Thenable<any>;

			/**
			 * Calculate the token count for a given string.
			 */
			provideTokenCount(text: string | vscode.LanguageModelChatMessage, token: vscode.CancellationToken): Thenable<number>;
		}

		export interface ChatAgentSlashCommands {
			name: string;
			description: string;
			isSticky?: boolean;
		}

		export interface ChatAgentData {
			id: string;
			name: string;
			fullName?: string;
			description?: string;
			isDefault?: boolean;
			metadata: { isSticky?: boolean };
			slashCommands: ChatAgentSlashCommands[];
			locations: ('panel' | 'terminal' | 'notebook' | 'editor' | 'editing-session')[];
			disambiguation: { category: string; description: string; examples: string[] }[];
		}

		export interface ChatParticipant extends vscode.ChatParticipant {
			id: string;
			agentData: ChatAgentData;
			iconPath: vscode.ThemeIcon;
		}

		/**
		 * Register a chat agent dynamically, without populating `package.json`. This allows for
		 * defining dynamic agent commands.
		 */
		export function registerChatAgent(agentData: ChatAgentData): Thenable<vscode.Disposable>;

		/**
		 * Positron Language Model source, used for user configuration of language models.
		 */
		export interface LanguageModelSource {
			type: 'chat' | 'completion';
			provider: { id: string; displayName: string };
			supportedOptions: ('apiKey' | 'baseUrl')[];
			defaults: {
				name: string;
				model: string;
				baseUrl?: string;
				apiKey?: string;
			};
		}

		/**
		 * Positron Language Model configuration.
		 */
		export interface LanguageModelConfig {
			provider: string;
			type: string;
			name: string;
			model: string;
			baseUrl?: string;
			apiKey?: string;
		}

		/**
		 * Request the current plot data.
		 */
		export function getCurrentPlotUri(): Thenable<string | undefined>;

		/**
		 * Get Positron global context information to be included with every request.
		 */
		export function getPositronChatContext(request: vscode.ChatRequest): Thenable<ChatContext>;

		/**
		 * Send a progress response to the chat response stream.
		 */
		export function responseProgress(token: unknown, part: vscode.ChatResponsePart | {
			uri: vscode.Uri;
			edits: vscode.TextEdit[];
		}): void;

		/**
		 * Show a modal dialog for language model configuration.
		 */
		export function showLanguageModelConfig(sources: LanguageModelSource[]): Thenable<LanguageModelConfig | undefined>;

		/**
		 * The context in which a chat request is made.
		 */
		export interface ChatContext {
			console?: {
				language: string;
				version: string;
			};
			variables?: {
				name: string;
				value: string;
				type: string;
			}[];
			shell?: string;
		}
	}
}
