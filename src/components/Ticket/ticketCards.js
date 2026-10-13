import { PRIORITY_OPTIONS, STATUS_OPTIONS, labelOf } from './labels';
import { RecordCards, listCardStyle, optionExtra } from '../listCards';

const priorityText = value => {
  const label = labelOf(PRIORITY_OPTIONS, value);
  if (!value || label === '-') {
    return '';
  }
  if (value === 'urgent') {
    return '紧急';
  }
  return `${label}优先级`;
};

const TicketCard = ({ item, columns, onOpen, variant }) => (
  <div className={listCardStyle.card} onClick={() => onOpen(item)}>
    <div className={listCardStyle.head}>
      <span className={listCardStyle.status} data-status={item.status}>
        <span className={listCardStyle.dot} />
        {labelOf(STATUS_OPTIONS, item.status)}
      </span>
      <div className={listCardStyle.actions} onClick={event => event.stopPropagation()}>
        {optionExtra(columns, item)}
      </div>
    </div>
    <div className={listCardStyle.title}>{item.title}</div>
    <div className={listCardStyle.meta}>{[item.no, priorityText(item.priority)].filter(Boolean).join(' · ')}</div>
    <div className={listCardStyle.facts}>
      <span>处理人 {item.assigneeName || '未指派'}</span>
      {item.templateName ? <span>模板 {item.templateName}</span> : null}
      {variant === 'mobile' && item.reporterName ? <span>提单人 {item.reporterName}</span> : null}
    </div>
  </div>
);

export const renderTicketCards = ({ FlexBox, onOpen, variant }) => props => (
  <RecordCards
    FlexBox={FlexBox}
    variant={variant}
    dataSource={props.dataSource}
    renderToolbar={props.renderToolbar}
    renderItem={(item, cardVariant) => <TicketCard item={item} columns={props.columns} onOpen={onOpen} variant={cardVariant} />}
  />
);
