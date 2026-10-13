const fp = require('fastify-plugin');
const fs = require('node:fs/promises');
const path = require('node:path');

const templateDir = path.resolve(__dirname, '../../ticketTemplate');

const httpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

module.exports = fp(async fastify => {
  const { Op } = fastify.sequelize.Sequelize;
  const models = () => fastify.project.models;

  const list = async query => {
    const currentPage = Number(query.currentPage) || 1;
    const perPage = Math.min(Number(query.perPage) || 20, 100);
    const where = {};
    if (query.enabledOnly === true || query.enabledOnly === 'true') {
      where.enabled = true;
    }
    if (query.keyword) {
      where.name = { [Op.like]: `%${String(query.keyword).trim()}%` };
    }
    const { rows, count } = await models().ticketBaseTemplate.findAndCountAll({
      where,
      order: [
        ['builtin', 'DESC'],
        ['updatedAt', 'DESC']
      ],
      limit: perPage,
      offset: (currentPage - 1) * perPage
    });
    return { pageData: rows, totalCount: count };
  };

  const save = async body => {
    const name = String(body.name || '').trim();
    if (!name) {
      throw httpError(400, '请填写模板名称');
    }
    const payload = {
      name,
      description: body.description || '',
      enabled: body.enabled !== false,
      schema: body.schema && typeof body.schema === 'object' ? body.schema : {}
    };
    if (body.id) {
      const record = await models().ticketBaseTemplate.findByPk(String(body.id));
      if (!record) {
        throw httpError(404, '公共模板不存在');
      }
      if (record.builtin) {
        throw httpError(400, '系统问卷不可修改');
      }
      await record.update(payload);
      return record;
    }
    return models().ticketBaseTemplate.create({ ...payload, builtin: false, code: null });
  };

  const remove = async ({ id }) => {
    const record = await models().ticketBaseTemplate.findByPk(String(id || ''));
    if (!record) {
      throw httpError(404, '公共模板不存在');
    }
    if (record.builtin) {
      throw httpError(400, '系统问卷不可删除');
    }
    await record.destroy();
    return {};
  };

  const ensureColumns = async () => {
    const qi = fastify.sequelize.instance.getQueryInterface();
    const table = 't_ticket_base_template';
    const desc = await qi.describeTable(table);
    const { DataTypes } = fastify.sequelize.Sequelize;
    if (!desc.code) {
      await qi.addColumn(table, 'code', { type: DataTypes.STRING, allowNull: true });
    }
    if (!desc.builtin) {
      await qi.addColumn(table, 'builtin', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false });
    }
    const indexes = await qi.showIndex(table);
    const hasCode = indexes.some(item => (item.name || '').includes('code') || (item.fields || []).some(field => (field.attribute || field.name) === 'code'));
    if (!hasCode) {
      await qi.addIndex(table, ['code'], { unique: true, name: 't_ticket_base_template_code' });
    }
  };

  const includeTemplate = async dir => {
    try {
      await fs.access(dir);
    } catch (error) {
      fastify.log.info('ticket template dir not exists');
      return;
    }
    fastify.log.info('------start include ticket template------');
    const list = await fs.readdir(dir);
    const model = models().ticketBaseTemplate;
    for (const file of list) {
      if (path.extname(file) !== '.json') {
        continue;
      }
      const filePath = path.join(dir, file);
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) {
        continue;
      }
      const filename = file.slice(0, -path.extname(file).length);
      const sep = filename.indexOf('_');
      if (sep <= 0) {
        continue;
      }
      const code = filename.slice(0, sep);
      const name = filename.slice(sep + 1);
      const parsed = JSON.parse(await fs.readFile(filePath, 'utf8'));
      const description = parsed.description || '';
      const schema = parsed.schema && typeof parsed.schema === 'object' ? parsed.schema : parsed;
      const existing = await model.findOne({ where: { code }, paranoid: false });
      if (existing) {
        if (existing.deletedAt) {
          await existing.restore();
        }
        existing.name = name;
        existing.description = description;
        existing.schema = schema;
        existing.builtin = true;
        existing.enabled = true;
        await existing.save();
        fastify.log.info(`update ticket template: ${code}`);
        continue;
      }
      await model.create({ code, name, description, schema, builtin: true, enabled: true });
      fastify.log.info(`create ticket template: ${code}`);
    }
    fastify.log.info('------end include ticket template------');
  };

  const ensureDefaults = async () => {
    await ensureColumns();
    await includeTemplate(templateDir);
  };

  fastify.project.services.ticketBase = { list, save, remove, ensureDefaults };
});
