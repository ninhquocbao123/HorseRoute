import {useFeedback} from '../../components/useFeedback';
import { useCallback, useEffect, useRef, useState, type ClipboardEvent } from 'react';
import { Alert, App, AutoComplete, Button, Form, Input, InputNumber, Modal, Select, Table, Tag, Tooltip } from 'antd';
import type { TableColumnsType } from 'antd';
import { errorMessage } from '../tracking/tracking.api';
import CountrySelect, { countryName } from '../orders/CountrySelect';
import MapView from '../trackmap/MapView';
import { LocationPickerMap } from '../trackmap/lazy-maps';
import { formatCoordinate } from '../trackmap/map-style';
import {
  locationsApi, LOCATION_TYPES, locationTypeInfo,
  type CatalogLocation, type CoordinatesFilter, type LocationInput, type LocationType,
} from './locations.api';
import { COUNTRY_TIMEZONE, isIanaTimezone, timezoneOptions } from './timezones';
import './locations.css';

type FormValues = { name: string; locationType: LocationType; country: string; timezone: string; address?: string; latitude: number | null; longitude: number | null };
const PAGE_SIZE = 10;
const COORDINATE_OPTIONS: { value: CoordinatesFilter; label: string }[] = [
  { value: 'all', label: 'Mọi trạng thái tọa độ' },
  { value: 'missing', label: 'Thiếu tọa độ' },
  { value: 'present', label: 'Đã có tọa độ' },
];
// "11.076, 106.158" or "11.076 106.158" pasted into the latitude box fills both fields.
const PAIR = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

/** Danh mục địa điểm & cửa khẩu (FR-TRP-02): Specialist thêm, sửa, ghim tọa độ trên bản đồ, xóa địa điểm chưa dùng. */
export default function LocationsWorkspace({ canEdit }: { canEdit: boolean }) {
  const { message, modal } = useFeedback();
  const [form] = Form.useForm<FormValues>();
  const [items, setItems] = useState<CatalogLocation[]>([]);
  const [total, setTotal] = useState(0);
  const [missingTotal, setMissingTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [locationType, setLocationType] = useState<LocationType | undefined>();
  const [country, setCountry] = useState<string | undefined>();
  const [coordinates, setCoordinates] = useState<CoordinatesFilter>('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState<CatalogLocation | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const requestId = useRef(0);
  const suggestedZone = useRef<string | undefined>();

  const latitude = Form.useWatch('latitude', form);
  const longitude = Form.useWatch('longitude', form);
  const formCountry = Form.useWatch('country', form);
  const filtered = !!(query || locationType || country || coordinates !== 'all');

  const load = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true);
    try {
      const [data, missing] = await Promise.all([
        locationsApi.list({ page, limit: PAGE_SIZE, locationType, country, coordinates, q: query }),
        locationsApi.list({ page: 1, limit: 1, coordinates: 'missing' }),
      ]);
      if (current !== requestId.current) return;
      const lastPage = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
      if (page > lastPage) { setPage(lastPage); return; }
      setItems(data.items);
      setTotal(data.total);
      setMissingTotal(missing.total);
      setLoadError('');
    } catch (error) {
      if (current === requestId.current) setLoadError(errorMessage(error, 'Không tải được danh mục địa điểm. Vui lòng thử lại.'));
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, [page, locationType, country, coordinates, query]);
  useEffect(() => { void load(); }, [load]);

  function openForm(location: CatalogLocation | 'new') {
    setFormError('');
    form.resetFields();
    suggestedZone.current = location === 'new' ? COUNTRY_TIMEZONE.VN : undefined;
    form.setFieldsValue(location === 'new'
      ? { locationType: 'REST_STOP', country: 'VN', timezone: COUNTRY_TIMEZONE.VN, latitude: null, longitude: null }
      : { name: location.name, locationType: location.locationType, country: location.country, timezone: location.timezone,
        address: location.address ?? '', latitude: location.latitude, longitude: location.longitude });
    setEditing(location);
  }

  function onCountryChange(next: string) {
    const zone = COUNTRY_TIMEZONE[next];
    const current = form.getFieldValue('timezone');
    // Follow the country only while the zone is still our own suggestion (or empty).
    if (zone && (!current || current === suggestedZone.current)) {
      form.setFieldValue('timezone', zone);
      suggestedZone.current = zone;
    }
  }

  function pasteCoordinates(event: ClipboardEvent<HTMLInputElement>) {
    const match = PAIR.exec(event.clipboardData.getData('text'));
    if (!match) return;
    event.preventDefault();
    form.setFieldsValue({ latitude: Number(match[1]), longitude: Number(match[2]) });
    void form.validateFields(['latitude', 'longitude']);
  }

  async function submit(values: FormValues) {
    if (!editing) return;
    setSaving(true);
    setFormError('');
    try {
      const input: LocationInput = {
        name: values.name.trim(), locationType: values.locationType, country: values.country, timezone: values.timezone.trim(),
        address: values.address?.trim() || null, latitude: values.latitude as number, longitude: values.longitude as number,
      };
      if (editing === 'new') {
        await locationsApi.create(input);
        message.success('Đã thêm địa điểm.');
        setLocationType(undefined); setCountry(undefined); setCoordinates('all'); setSearch(''); setQuery(''); setPage(1);
      } else {
        await locationsApi.update(editing.id, input);
        message.success('Đã cập nhật địa điểm.');
      }
      setEditing(null);
      await load();
    } catch (error) {
      setFormError(errorMessage(error, 'Không lưu được địa điểm. Vui lòng thử lại.'));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(location: CatalogLocation) {
    modal.confirm({
      title: `Xóa địa điểm ${location.name}?`,
      content: 'Thao tác này không hoàn tác được. Địa điểm chưa có chặng hay quy định nào tham chiếu nên xóa an toàn.',
      okText: 'Xóa', okButtonProps: { danger: true }, cancelText: 'Giữ lại', centered: true,
      async onOk() {
        try {
          await locationsApi.remove(location.id);
          message.success('Đã xóa địa điểm.');
          await load();
        } catch (error) {
          message.error(errorMessage(error, 'Không xóa được địa điểm.'));
          throw error;
        }
      },
    });
  }

  const columns: TableColumnsType<CatalogLocation> = [
    {
      title: 'Địa điểm', dataIndex: 'name',
      render: (name: string, location) => <span className="locations-name"><strong>{name}</strong>{location.address && <small>{location.address}</small>}</span>,
    },
    { title: 'Loại', dataIndex: 'locationType', render: (type: LocationType) => { const info = locationTypeInfo(type); return <Tag color={info.color}>{info.label}</Tag>; } },
    { title: 'Quốc gia', dataIndex: 'country', render: (code: string) => <span>{countryName(code)} <span className="locations-muted">({code})</span></span> },
    { title: 'Múi giờ', dataIndex: 'timezone', render: (zone: string) => <span className="locations-mono">{zone}</span> },
    {
      title: 'Tọa độ', key: 'coordinates',
      render: (_value, location) => location.latitude === null || location.longitude === null
        ? <Tooltip title="Bản đồ không vẽ được các chặng đi qua địa điểm này cho đến khi được ghim."><Tag color="warning">Thiếu tọa độ</Tag></Tooltip>
        : <span className="locations-mono">{formatCoordinate(location.latitude)}, {formatCoordinate(location.longitude)}</span>,
    },
    {
      title: 'Sử dụng', key: 'usage',
      render: (_value, location) => (
        <span className="locations-tags">
          <span className="locations-muted">{location.legCount} chặng{location.ruleCount ? ` · ${location.ruleCount} quy định` : ''}</span>
          {location.inActiveUse && <Tooltip title="Nằm trong kế hoạch đã duyệt của đơn chưa giao xong."><Tag color="processing">Đang dùng</Tag></Tooltip>}
        </span>
      ),
    },
  ];
  if (canEdit) {
    columns.push({
      title: 'Thao tác', key: 'actions', align: 'right',
      render: (_value, location) => {
        const blocked = location.legCount > 0 ? 'Địa điểm đã được dùng trong kế hoạch chuyến.' : location.ruleCount > 0 ? 'Địa điểm là cửa khẩu trong quy định kiểm dịch.' : '';
        return (
          <span className="locations-actions">
            <Button size="small" onClick={() => openForm(location)} aria-label={`Sửa ${location.name}`}>{location.latitude === null ? 'Ghim vị trí' : 'Sửa'}</Button>
            <Tooltip title={blocked}>
              <Button size="small" danger disabled={!!blocked} onClick={() => confirmDelete(location)} aria-label={`Xóa ${location.name}`}>Xóa</Button>
            </Tooltip>
          </span>
        );
      },
    });
  }

  const typeLocked = editing !== null && editing !== 'new' && (editing.inActiveUse || editing.ruleCount > 0);
  const pinned = typeof latitude === 'number' && typeof longitude === 'number' ? { latitude, longitude } : null;

  return (
    <section className="portal-panel locations" aria-labelledby="locations-title">
      <div className="locations-heading">
        <div>
          <h2 id="locations-title">Danh mục địa điểm</h2>
          <p>Danh mục điểm dừng dùng khi lập kế hoạch chuyến và vẽ tuyến trên bản đồ. Tọa độ đặt bằng ghim trên bản đồ.</p>
        </div>
        {canEdit && <Button type="primary" onClick={() => openForm('new')}>Thêm địa điểm</Button>}
      </div>
      {missingTotal > 0 && coordinates !== 'missing' && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          title={`${missingTotal} địa điểm chưa có tọa độ: bản đồ sẽ không vẽ được các chặng đi qua chúng.`}
          action={<Button size="small" onClick={() => { setCoordinates('missing'); setPage(1); }}>Xem</Button>} />
      )}
      <div className="locations-filters">
        <Input.Search
          allowClear placeholder="Tìm theo tên" maxLength={150} value={search}
          onChange={event => { setSearch(event.target.value); if (!event.target.value) { setQuery(''); setPage(1); } }}
          onSearch={value => { setQuery(value.trim()); setPage(1); }} aria-label="Tìm địa điểm"
        />
        <Select allowClear placeholder="Mọi loại" value={locationType} options={LOCATION_TYPES} onChange={value => { setLocationType(value); setPage(1); }} aria-label="Lọc theo loại" />
        <CountrySelect id="locations-country-filter" label={null} allowClear placeholder="Mọi quốc gia" value={country}
          onChange={value => { setCountry(value || undefined); setPage(1); }} />
        <Select value={coordinates} options={COORDINATE_OPTIONS} onChange={value => { setCoordinates(value); setPage(1); }} aria-label="Lọc theo tọa độ" />
        <Button onClick={() => void load()} disabled={loading}>Làm mới</Button>
      </div>
      {loadError && <Alert type="error" showIcon title={loadError} action={<Button size="small" onClick={() => void load()}>Thử lại</Button>} style={{ marginBottom: 16 }} />}
      <Table<CatalogLocation>
        rowKey="id" size="middle" columns={columns} dataSource={items} loading={loading} scroll={{ x: 'max-content' }}
        locale={{ emptyText: filtered ? 'Không có địa điểm phù hợp bộ lọc.' : 'Chưa có địa điểm nào.' }}
        pagination={{ current: page, pageSize: PAGE_SIZE, total, showSizeChanger: false, hideOnSinglePage: true, onChange: setPage, showTotal: count => `${count} địa điểm` }}
      />

      <Modal
        open={editing !== null} destroyOnHidden centered width={760} mask={{ closable: !saving }} keyboard={!saving}
        title={editing === 'new' ? 'Thêm địa điểm' : 'Sửa địa điểm'}
        okText={editing === 'new' ? 'Thêm' : 'Lưu'} cancelText="Hủy" confirmLoading={saving}
        onOk={() => form.submit()} onCancel={() => { if (!saving) setEditing(null); }}
      >
        {formError && <Alert type="error" showIcon title={formError} style={{ marginBottom: 16 }} />}
        <Form form={form} layout="vertical" onFinish={values => void submit(values)} requiredMark="optional" className="locations-form">
          <div className="locations-form-grid">
            <Form.Item name="name" label="Tên địa điểm" rules={[{ required: true, whitespace: true, message: 'Nhập tên địa điểm.' }, { max: 150, message: 'Tối đa 150 ký tự.' }]}>
              <Input maxLength={150} autoComplete="off" />
            </Form.Item>
            <Form.Item name="locationType" label="Loại" rules={[{ required: true, message: 'Chọn loại địa điểm.' }]}
              extra={typeLocked ? 'Đang dùng trong kế hoạch đã duyệt hoặc quy định kiểm dịch: không đổi loại được.' : undefined}>
              <Select options={LOCATION_TYPES} disabled={typeLocked} />
            </Form.Item>
            <Form.Item name="country" label="Quốc gia / vùng lãnh thổ" rules={[{ required: true, message: 'Chọn quốc gia.' }]}>
              <CountrySelect id="location-country" label={null} value={undefined} onChange={onCountryChange} />
            </Form.Item>
            <Form.Item name="timezone" label="Múi giờ (IANA)" rules={[
              { required: true, whitespace: true, message: 'Nhập múi giờ.' },
              { validator: (_rule, value?: string) => !value || isIanaTimezone(value.trim()) ? Promise.resolve() : Promise.reject(new Error('Dùng tên IANA, ví dụ Asia/Ho_Chi_Minh.')) },
            ]}>
              <AutoComplete options={timezoneOptions(items.map(i => i.timezone))} filterOption={(input, option) => String(option?.value).toLowerCase().includes(input.toLowerCase())}>
                <Input maxLength={50} autoComplete="off" placeholder="Asia/Ho_Chi_Minh" />
              </AutoComplete>
            </Form.Item>
          </div>
          <Form.Item name="address" label="Địa chỉ" rules={[{ max: 255, message: 'Tối đa 255 ký tự.' }]}>
            <Input maxLength={255} autoComplete="off" />
          </Form.Item>
          <div className="locations-map-field">
            <span className="locations-map-label">Vị trí trên bản đồ</span>
            <MapView height={300} label="Bản đồ chọn vị trí địa điểm" hint="Hãy nhập vĩ độ và kinh độ (WGS84) ở hai ô bên dưới.">
              <LocationPickerMap value={pinned} country={formCountry}
                onChange={next => { form.setFieldsValue(next); void form.validateFields(['latitude', 'longitude']); }} />
            </MapView>
          </div>
          <div className="locations-form-grid">
            <Form.Item name="latitude" label="Vĩ độ" extra="Dán “vĩ độ, kinh độ” vào ô này để điền cả hai." rules={[
              { required: true, message: 'Đặt ghim hoặc nhập vĩ độ.' },
              { type: 'number', min: -90, max: 90, message: 'Vĩ độ trong khoảng −90 đến 90.' },
            ]}>
              <InputNumber min={-90} max={90} step={0.000001} precision={6} style={{ width: '100%' }} onPaste={pasteCoordinates} />
            </Form.Item>
            <Form.Item name="longitude" label="Kinh độ" dependencies={['latitude']} rules={[
              { required: true, message: 'Đặt ghim hoặc nhập kinh độ.' },
              { type: 'number', min: -180, max: 180, message: 'Kinh độ trong khoảng −180 đến 180.' },
              ({ getFieldValue }) => ({ validator: (_rule, value) => value === 0 && getFieldValue('latitude') === 0 ? Promise.reject(new Error('Hãy đặt ghim vị trí thật (không dùng 0, 0).')) : Promise.resolve() }),
            ]}>
              <InputNumber min={-180} max={180} step={0.000001} precision={6} style={{ width: '100%' }} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </section>
  );
}
