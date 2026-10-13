import style from './listCards.module.scss';

export const CARD_COLUMNS = [
  { width: 576, col: 1 },
  { width: 992, col: 2 },
  { width: 1400, col: 3 },
  { width: 1800, col: 4 }
];

export const optionExtra = (columns, item) => {
  const column = (columns || []).find(col => col.name === 'options' || col.renderType === 'options');
  if (typeof column?.getValueOf !== 'function') {
    return null;
  }
  const value = column.getValueOf(item, { place: 'end' });
  return value?.children || null;
};

export const RecordCards = ({ FlexBox, variant = 'card', dataSource = [], renderToolbar, renderItem }) => {
  if (!dataSource.length) {
    return null;
  }
  const toolbar = typeof renderToolbar === 'function' ? renderToolbar() : null;
  const cards =
    variant === 'mobile' || !FlexBox ? (
      <div className={style.stack}>
        {dataSource.map(item => (
          <div key={item.id}>{renderItem(item, 'mobile')}</div>
        ))}
      </div>
    ) : (
      <FlexBox columns={CARD_COLUMNS} dataSource={dataSource} rowKey="id" gutter={[12, 12]} renderItem={item => <FlexBox.Item>{renderItem(item, 'card')}</FlexBox.Item>} />
    );

  return (
    <div className={style.wrap}>
      {toolbar}
      {cards}
    </div>
  );
};

export { style as listCardStyle };
