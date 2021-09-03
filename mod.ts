export interface GetDatabaseOptions {
	auth?: string
}

export interface AddDatabaseOptions {
	auth?: string
	masterPassword?: string
}

export interface DatabaseUsage {
	size: number
	requests: {
		read: number
		write: number
	}
}

export interface Instance {
	getDatabase(name: string, options: GetDatabaseOptions): Database
	addDatabase(name: string, options: AddDatabaseOptions): Promise<Database>
}

export interface Database {
	getName: () => string
	remove(): Promise<void>
	edit(newName: string, newAuth: string | null): Promise<void>
	listCollections(): Promise<string[]>
	getCollection(name: string): Collection
	addCollection(name: string): Promise<Collection>
	exists(): Promise<boolean>
	getUsage(): Promise<DatabaseUsage>
}

export interface Collection {
	getName: () => string
	remove(): Promise<void>
	edit(newName: string): Promise<void>
	listDocuments(): Promise<string[]>
	getDocument<T>(id: string): Document<T>
	addDocument<T>(body: T): Promise<Document<T>>
	findOneDocument(key: string, values: (string | RegExp)[]): Promise<string | null>
	findManyDocuments(key: string, values: (string | RegExp)[]): Promise<string[]>
	exists(): Promise<boolean>
}

export interface Document<T> {
	getId: () => string
	safeLoad(): Promise<T | null>
	load(): Promise<T>
	remove(): Promise<void>
	set(newValue: T): Promise<void>
}

export function getInstance(host: string): Instance {
	if (host.endsWith('/')) host = host.slice(0, -1)

	function getDatabase(databaseName: string, { auth }: GetDatabaseOptions = {}): Database {
		async function remove(): Promise<void> {
			await fetch(`${host}/${databaseName}`, {
				method: 'DELETE',
				headers: { authentication: auth ?? '' },
			}).then(async res => {
				if (!res.ok) throw new Error(`Received status ${res.status} from server when deleting a database: ${await res.json()}`)
			})
		}

		async function edit(newName: string, newAuth: string | null): Promise<void> {
			await fetch(`${host}/${databaseName}`, {
				method: 'PUT',
				headers: { authentication: auth ?? '', 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newName, auth: newAuth }),
			}).then(async res => {
				if (!res.ok) throw new Error(`Received status ${res.status} from server when editing a database: ${await res.json()}`)

				databaseName = newName
			})
		}

		async function listCollections(): Promise<string[]> {
			return await fetch(`${host}/${databaseName}/collections`, {
				headers: { authentication: auth ?? '' },
			}).then(async res => {
				if (res.ok) return res.json().then(json => json.data)

				throw new Error(`Received status ${res.status} from server when listing collections. ${await res.json()}`)
			})
		}

		function getCollection(collectionName: string): Collection {
			async function remove(): Promise<void> {
				await fetch(`${host}/${databaseName}/collections/${collectionName}`, {
					method: 'DELETE',
					headers: { authentication: auth ?? '' },
				}).then(async res => {
					if (!res.ok)
						throw new Error(`Received status ${res.status} from server when deleting a collection: ${await res.json()}`)
				})
			}

			async function edit(name: string): Promise<void> {
				await fetch(`${host}/${databaseName}/collections/${collectionName}`, {
					method: 'PUT',
					headers: { authentication: auth ?? '', 'Content-Type': 'application/json' },
					body: JSON.stringify({ name }),
				}).then(async res => {
					if (!res.ok) throw new Error(`Received status ${res.status} from server when editing a collection: ${await res.json()}`)

					collectionName = name
				})
			}

			async function listDocuments(): Promise<string[]> {
				return await fetch(`${host}/${databaseName}/collections`, {
					headers: { authentication: auth ?? '' },
				}).then(async res => {
					if (res.ok) return res.json().then(json => json.data)

					throw new Error(`Received status ${res.status} from server when listing documents. ${await res.json()}`)
				})
			}

			function getDocument<T>(documentId: string): Document<T> {
				async function safeLoad(): Promise<T | null> {
					return await fetch(`${host}/${databaseName}/collections/${collectionName}/documents/${documentId}`, {
						headers: { authentication: auth ?? '' },
					}).then(async res => {
						if (res.ok) return res.json().then(json => json.data)
						if (res.status === 404) return null

						throw new Error(`Received status ${res.status} from server when fetching document. ${await res.json()}`)
					})
				}

				async function load(): Promise<T> {
					const res = await safeLoad()
					if (res === null) throw new Error(`Could not find document '${documentId}'`)
					return res
				}

				async function remove(): Promise<void> {
					await fetch(`${host}/${databaseName}/collections/${collectionName}/documents/${documentId}`, {
						method: 'DELETE',
						headers: { authentication: auth ?? '' },
					}).then(async res => {
						if (!res.ok)
							throw new Error(`Received status ${res.status} from server when deleting document. ${await res.json()}`)
					})
				}

				async function set(body: T): Promise<void> {
					if (documentId !== (body as unknown as Record<string, string>)['id']) await remove()

					await fetch(`${host}/${databaseName}/collections/${collectionName}/setDocument`, {
						method: 'POST',
						headers: { authentication: auth ?? '', 'Content-Type': 'application/json' },
						body: JSON.stringify(body),
					}).then(async res => {
						if (!res.ok) throw new Error(`Received status ${res.status} from server when setting document. ${await res.json()}`)

						const json = await res.json()
						documentId = json.data
					})
				}

				return {
					getId: () => documentId,
					safeLoad,
					load,
					remove,
					set,
				}
			}

			async function addDocument<T>(body: T): Promise<Document<T>> {
				const id = await fetch(`${host}/${databaseName}/collections/${collectionName}/setDocument`, {
					method: 'POST',
					headers: { authentication: auth ?? '', 'Content-Type': 'application/json' },
					body: JSON.stringify(body),
				}).then(async res => {
					if (!res.ok) throw new Error(`Received status ${res.status} from server when setting document. ${await res.json()}`)

					const json = await res.json()
					return json.data
				})

				return getDocument(id)
			}

			async function findOneDocument(key: string, values: (string | RegExp)[]): Promise<string | null> {
				return await fetch(`${host}/${databaseName}/collections/${collectionName}/findOneDocument`, {
					method: 'POST',
					headers: { authentication: auth ?? '', 'Content-Type': 'application/json' },
					body: JSON.stringify({ key, values: values.map(v => (typeof v === 'string' ? `str:${v}` : `regex:${v}`)) }),
				}).then(async res => {
					if (!res.ok)
						throw new Error(`Received status ${res.status} from server when looking for a document: ${await res.json()}`)

					const json = await res.json()
					return json.data
				})
			}

			async function findManyDocuments(key: string, values: (string | RegExp)[]): Promise<string[]> {
				return await fetch(`${host}/${databaseName}/collections/${collectionName}/findManyDocuments`, {
					method: 'POST',
					headers: { authentication: auth ?? '', 'Content-Type': 'application/json' },
					body: JSON.stringify({ key, values: values.map(v => (typeof v === 'string' ? `str:${v}` : `regex:${v}`)) }),
				}).then(async res => {
					if (!res.ok)
						throw new Error(`Received status ${res.status} from server when looking for documents: ${await res.json()}`)

					const json = await res.json()
					return json.data
				})
			}

			async function exists() {
				return await fetch(`${host}/${databaseName}/collections/${collectionName}`, {
					headers: { authentication: auth ?? '' },
				}).then(res => {
					if (!res.ok) return false
					return true
				})
			}

			return {
				getName: () => collectionName,
				remove,
				edit,
				listDocuments,
				getDocument,
				addDocument,
				findOneDocument,
				findManyDocuments,
				exists,
			}
		}

		async function addCollection(name: string): Promise<Collection> {
			await fetch(`${host}/${databaseName}/collections`, {
				method: 'POST',
				headers: { authentication: auth ?? '', 'Content-Type': 'application/json' },
				body: JSON.stringify({ name }),
			}).then(async res => {
				if (!res.ok) throw new Error(`Received status ${res.status} from server when adding a collection: ${await res.json()}`)
			})

			return getCollection(name)
		}

		async function exists() {
			try {
				await getUsage()
				return true
			} catch (_) {
				return false
			}
		}

		async function getUsage(): Promise<DatabaseUsage> {
			const usage: DatabaseUsage = await fetch(`${host}/${databaseName}`, {
				headers: { authentication: auth ?? '' },
			}).then(async res => {
				if (!res.ok) throw new Error(`Received status ${res.status} from server when adding a collection: ${await res.json()}`)

				return res.json()
			})

			return usage
		}

		return {
			getName: () => databaseName,
			remove,
			edit,
			listCollections,
			getCollection,
			addCollection,
			exists,
			getUsage,
		}
	}

	async function addDatabase(name: string, options: AddDatabaseOptions = {}): Promise<Database> {
		await fetch(`${host}`, {
			method: 'POST',
			headers: { authentication: options.masterPassword ?? '', 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, auth: options.auth || null }),
		}).then(async res => {
			if (!res.ok) throw new Error(`Received status ${res.status} from server when adding a database: ${await res.json()}`)
		})

		return getDatabase(name, { auth: options.auth })
	}

	return {
		getDatabase,
		addDatabase,
	}
}
