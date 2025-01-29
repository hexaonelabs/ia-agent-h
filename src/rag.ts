// import { loadQAStuffChain } from 'langchain/chains';
// import { PDFLoader } from 'langchain/document_loaders/fs/pdf';

// import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { join } from 'path';

import * as lancedb from '@lancedb/lancedb';
import '@lancedb/lancedb/embedding/openai';
import { embedding } from '@lancedb/lancedb';
import { Utf8 } from 'apache-arrow';
import { Document } from '@langchain/core/documents';

const dbAdaptator = async (databaseDir: string) => {
  const db = await lancedb.connect(databaseDir);
  const func = embedding.getRegistry().get('openai')?.create({
    model: 'text-embedding-3-small',
  }) as embedding.EmbeddingFunction;

  const schema = embedding.LanceSchema({
    text: func.sourceField(new Utf8()),
    vector: func.vectorField(),
  });
  const existingDefaultTbl = await db
    .openTable('default_table')
    .catch(() => null);
  if (!existingDefaultTbl) {
    const defaultTbl = await db.createEmptyTable('default_table', schema);
    console.log('created table: ', defaultTbl.name);
    // await defaultTbl.createIndex('vector');
  }
  const tbl = await db.openTable('default_table');
  // return formated object
  return {
    db,
    createTable: async (
      name: string,
      data: any,
      withIndex: boolean = false,
    ) => {
      const tbl = await db.createTable(name, data, { mode: 'overwrite' });
      if (withIndex) {
        await tbl.createIndex('vector');
      }
      return tbl;
    },
    getTable: async (name: string = tbl.name) => {
      const tbl = await db.openTable(name);
      return tbl;
    },
    listTablesName: async () => {
      const tables = await db.tableNames();
      return tables;
    },
    search: async (query: string, table: string = tbl.name) => {
      const tbl = await db.openTable(table);
      const result = await tbl.search(query).limit(2).toArray();
      return result.map((e) => e.text);
    },
    deleteRow: async (filter: string, table: string = tbl.name) => {
      const tbl = await db.openTable(table);
      await tbl.delete(filter);
    },
    save: async (data: Document[], table: string = tbl.name) => {
      const tbl = await db.openTable(table);
      const totalFields = (await tbl.countRows()) || 0;
      const formated = data.map((e) => ({
        text: e.pageContent,
        id: totalFields + 1,
      }));
      await tbl.add(formated);
    },
  };
};

const dbPath = join(process.cwd(), 'datastore');
export const initDB = async () => {
  const db = await dbAdaptator(dbPath);
  return db;
};

// function to extract data from the database
// export const ask = async () => {
//   try {
//     const llm = new OpenAI({ modelName: 'gpt-3.5-turbo' });
//     const chain = loadQAStuffChain(llm);
//     const directory = process.env.DIR; //saved directory in .env file

//     const loadedVectorStore = await FaissStore.load(
//       directory,
//       new OpenAIEmbeddings(),
//     );

//     const question = 'what is this article about?'; //question goes here.
//     const result = await loadedVectorStore.similaritySearch(question, 1);
//     const res = await chain.invoke({
//       input_documents: result,
//       question,
//     });
//     // console.log({ resA });
//     return { result: res }; // Send the response as JSON
//   } catch (error) {
//     console.error(error);
//     return { error: 'Internal Server Error' }; // Send an error response
//   }
// };

// export const learnFromDocs = async () => {
//   const loader = new PDFLoader('10.1.1.83.5248.pdf'); //you can change this to any PDF file of your choice.
//   const docs = await loader.load();
//   console.log('docs loaded');

//   const textSplitter = new RecursiveCharacterTextSplitter({
//     chunkSize: 1000,
//     chunkOverlap: 200,
//   });

//   const docOutput = await textSplitter.splitDocuments(docs);
//   const vectorStore = db;
//   console.log('saving...');

//   const directory = '/Users/yinka/Documents/art/OPENAI-PDF-CHATBOT/';
//   await vectorStore.save(directory);
//   console.log('saved!');
// };
