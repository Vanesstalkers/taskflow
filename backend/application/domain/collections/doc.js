({
  /** Поля для `api.core.search` по коллекции `doc` */
  searchFields: ['fileName', 'title'],
  schema: {
    title: '',
    /** Имя файла в `application/resources` после загрузки (`api/files`) */
    fileName: '',
  },
});
