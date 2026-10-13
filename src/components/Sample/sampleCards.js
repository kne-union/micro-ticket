import { RecordCards, listCardStyle, optionExtra } from '../listCards';

const SampleCard = ({ item, columns, statusLabel, updatedLabel }) => (
  <div className={`${listCardStyle.card} ${listCardStyle['is-static']}`}>
    <div className={listCardStyle.head}>
      <span className={listCardStyle.status} data-status={item.status}>
        <span className={listCardStyle.dot} />
        {statusLabel}
      </span>
      <div className={listCardStyle.actions}>{optionExtra(columns, item)}</div>
    </div>
    <div className={listCardStyle.title}>{item.name}</div>
    {item.description ? <div className={listCardStyle.desc}>{item.description}</div> : null}
    {item.updatedAt ? <div className={listCardStyle.meta}>{updatedLabel ? `${updatedLabel} ${item.updatedAt}` : item.updatedAt}</div> : null}
  </div>
);

export const renderSampleCards = ({ FlexBox, variant, statusText, updatedLabel }) => props => (
  <RecordCards
    FlexBox={FlexBox}
    variant={variant}
    dataSource={props.dataSource}
    renderToolbar={props.renderToolbar}
    renderItem={item => <SampleCard item={item} columns={props.columns} statusLabel={statusText(item.status)} updatedLabel={updatedLabel} />}
  />
);
